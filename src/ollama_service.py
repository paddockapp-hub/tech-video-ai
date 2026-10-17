"""
Ollama Service Module
Ollama 후보를 실제 API 응답으로 검증하고 텍스트를 생성합니다.
"""

import json
import re
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlsplit

import requests

try:
    from .env_utils import get_env_value, resolve_env_value
except ImportError:
    from env_utils import get_env_value, resolve_env_value


PRIORITY_CANDIDATES = [
    ("OLLAMA_BASE_URL_14", "OLLAMA_MODEL_13"),
    ("OLLAMA_BASE_URL_10_3_2", "OLLAMA_MODEL_8_3_2"),
    ("OLLAMA_BASE_URL_10_3", "OLLAMA_MODEL_8_3"),
    ("OLLAMA_BASE_URL_10_2", "OLLAMA_MODEL_8_2"),
    ("OLLAMA_BASE_URL_10", "OLLAMA_MODEL_8"),
    ("OLLAMA_BASE_URL", "OLLAMA_MODEL"),
]
BASE_URL_NAMES = [
    "OLLAMA_BASE_URL",
    "OLLAMA_BASE_URL_2",
    "OLLAMA_BASE_URL_3",
    "OLLAMA_BASE_URL_4",
    "OLLAMA_BASE_URL_5",
    "OLLAMA_BASE_URL_6",
    "OLLAMA_BASE_URL_7",
    "OLLAMA_BASE_URL_8",
    "OLLAMA_BASE_URL_9",
    "OLLAMA_BASE_URL_10",
    "OLLAMA_BASE_URL_10_2",
    "OLLAMA_BASE_URL_10_3",
    "OLLAMA_BASE_URL_10_3_2",
    "OLLAMA_BASE_URL_14",
]
MODEL_NAMES = [
    "OLLAMA_MODEL",
    "OLLAMA_MODEL_2",
    "OLLAMA_MODEL_3",
    "OLLAMA_MODEL_4",
    "OLLAMA_MODEL_5",
    "OLLAMA_MODEL_6",
    "OLLAMA_MODEL_7",
    "OLLAMA_MODEL_9",
    "OLLAMA_MODEL_8",
    "OLLAMA_MODEL_8_2",
    "OLLAMA_MODEL_8_3",
    "OLLAMA_MODEL_8_3_2",
    "OLLAMA_MODEL_13",
]


class OllamaUnavailableError(RuntimeError):
    """Raised when no configured Ollama endpoint can serve its configured model."""

    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


class OllamaService:
    _MODEL_VALUE_PATTERN = re.compile(
        r"^[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?$"
    )
    _MODEL_TOKEN_PATTERN = re.compile(
        r"(?<![A-Za-z0-9._/-])"
        r"[A-Za-z0-9][A-Za-z0-9._/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?"
        r"(?![A-Za-z0-9._/-])"
    )

    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = "llama3.2:latest",
        timeout: float = 5,
        session=None,
    ):
        self.host = (resolve_env_value(host) or "").rstrip("/")
        self.model = resolve_env_value(model) or ""
        self.timeout = timeout
        self.session = session or requests
        self.api_url = f"{self.host}/api/generate"
        self.selected_candidate: Optional[Dict[str, str]] = None
        self.available_models: List[str] = []
        self.candidate_statuses: List[Dict[str, str]] = []
        self.status = "not-checked"
        self.last_error: Optional[str] = None
        self.last_generation_source = "none"
        self.last_analysis_source = "none"
        self.last_response: Optional[str] = None
        self._candidates = self._load_candidates()

    @staticmethod
    def _normalize_url(url: str) -> str:
        return url.rstrip("/")

    @classmethod
    def _normalize_model(cls, value: Optional[str]) -> Optional[str]:
        resolved = resolve_env_value(value)
        if not resolved:
            return None
        cleaned = resolved.strip().strip("`'\";,")
        if cls._MODEL_VALUE_PATTERN.fullmatch(cleaned):
            return cleaned
        for token in cls._MODEL_TOKEN_PATTERN.findall(cleaned):
            if (
                cls._MODEL_VALUE_PATTERN.fullmatch(token)
                and re.search(r"[0-9.:/-]", token)
            ):
                return token
        return None

    @staticmethod
    def _is_placeholder_url(url: str) -> bool:
        try:
            hostname = (urlsplit(url).hostname or "").lower()
        except ValueError:
            return True
        return (
            not hostname
            or hostname.endswith((".example", ".invalid", ".test"))
            or hostname in ("example.com", "www.example.com")
            or "your-domain" in hostname
            or "your-ngrok-url" in hostname
            or hostname.startswith("abc123.")
            or any(marker in hostname for marker in ("placeholder", "replace-me", "your-url"))
        )

    def _load_candidates(self) -> List[Dict[str, str]]:
        candidates = []
        seen = set()
        ordered_pairs = list(PRIORITY_CANDIDATES)

        for url_name in BASE_URL_NAMES:
            if url_name == "OLLAMA_BASE_URL_14":
                continue
            suffix = url_name[len("OLLAMA_BASE_URL"):]
            model_name = f"OLLAMA_MODEL{suffix}"
            pair = (url_name, model_name)
            if pair not in ordered_pairs:
                ordered_pairs.append(pair)

        for url_name, model_name in ordered_pairs:
            url_value = get_env_value(url_name)
            model_value = self._normalize_model(get_env_value(model_name))
            if not model_value and url_name == "OLLAMA_BASE_URL":
                model_value = self._normalize_model(self.model)
            if not model_value and url_name == "OLLAMA_BASE_URL_14":
                model_value = (
                    self._normalize_model(get_env_value("OLLAMA_MODEL"))
                    or "llama3.2:latest"
                )
            if not url_value or not model_value:
                continue
            url = self._normalize_url(url_value.strip())
            if not url or not model_value or (url, model_value) in seen:
                continue
            seen.add((url, model_value))
            if self._is_placeholder_url(url):
                self.candidate_statuses.append({
                    "source": f"{url_name}+{model_name}",
                    "status": "placeholder-skipped",
                })
                continue
            candidates.append({
                "url": url,
                "model": model_value,
                "source": f"{url_name}+{model_name}",
            })

        # Constructor arguments preserve compatibility for callers that pass an explicit host.
        if self.host and self.model and (self.host, self.model) not in seen:
            if self._is_placeholder_url(self.host):
                self.candidate_statuses.append({
                    "source": "configured",
                    "status": "placeholder-skipped",
                })
            else:
                candidates.append({
                    "url": self.host,
                    "model": self.model,
                    "source": "configured",
                })
        host = get_env_value("OLLAMA_HOST")
        if host:
            normalized_host = self._normalize_url(host.strip())
            for model_name in MODEL_NAMES:
                model_value = self._normalize_model(get_env_value(model_name))
                if not model_value:
                    continue
                pair = (normalized_host, model_value)
                if pair in seen:
                    continue
                seen.add(pair)
                if self._is_placeholder_url(pair[0]):
                    self.candidate_statuses.append({
                        "source": f"OLLAMA_HOST+{model_name}",
                        "status": "placeholder-skipped",
                    })
                    continue
                candidates.append({
                    "url": pair[0],
                    "model": pair[1],
                    "source": f"OLLAMA_HOST+{model_name}",
                })

        return candidates

    @staticmethod
    def _is_html_response(response) -> bool:
        content_type = response.headers.get("Content-Type", "").lower()
        body = response.text[:512].lstrip().lower()
        return "text/html" in content_type or body.startswith(("<!doctype html", "<html"))

    @staticmethod
    def _has_embedded_credentials(url: str) -> bool:
        parsed = urlsplit(url)
        return parsed.username is not None or parsed.password is not None

    @staticmethod
    def _request_headers(url: str) -> Dict[str, str]:
        parsed = urlsplit(url)
        if (
            parsed.scheme == "https"
            and parsed.hostname
            and parsed.hostname.lower().endswith(".trycloudflare.com")
        ):
            token = get_env_value("AUTH_TOKEN")
            if token:
                return {"Authorization": f"Bearer {token}"}
        return {}

    @staticmethod
    def _installed_model_name(configured_model: str, installed_models: List[str]) -> Optional[str]:
        if configured_model in installed_models:
            return configured_model
        if ":" not in configured_model:
            latest_tag = f"{configured_model}:latest"
            if latest_tag in installed_models:
                return latest_tag
        return None

    def _probe_candidate(self, candidate: Dict[str, str]) -> Tuple[bool, str, List[str]]:
        base_url = candidate["url"]
        if self._has_embedded_credentials(base_url):
            return False, "tunnel-not-ollama", []

        try:
            headers = self._request_headers(base_url)
            version = self.session.get(
                f"{base_url}/api/version",
                headers=headers,
                timeout=self.timeout,
            )
        except requests.exceptions.RequestException:
            version = None
        try:
            tags = self.session.get(
                f"{base_url}/api/tags",
                headers=headers,
                timeout=self.timeout,
            )
        except requests.exceptions.RequestException:
            tags = None
        if version is None or tags is None:
            return False, "ollama-unreachable", []

        if version.status_code == 404 or tags.status_code == 404:
            return False, "tunnel-not-ollama", []
        if self._is_html_response(version) or self._is_html_response(tags):
            return False, "tunnel-not-ollama", []
        if version.status_code != 200:
            return False, "tunnel-not-ollama", []
        if tags.status_code != 200:
            return False, "tunnel-not-ollama", []

        try:
            tags_payload = tags.json()
        except (ValueError, json.JSONDecodeError):
            return False, "tunnel-not-ollama", []

        models = tags_payload.get("models") if isinstance(tags_payload, dict) else None
        if not isinstance(models, list):
            return False, "tunnel-not-ollama", []
        installed_models = [
            item.get("name")
            for item in models
            if isinstance(item, dict) and isinstance(item.get("name"), str)
        ]
        if self._installed_model_name(candidate["model"], installed_models) is None:
            return False, "model-not-installed", installed_models
        return True, "connected", installed_models

    def discover(self, refresh: bool = False) -> Dict[str, str]:
        """Select the first configured endpoint verified by Ollama's real API."""
        if self.selected_candidate and not refresh:
            return self.selected_candidate

        self.selected_candidate = None
        self.available_models = []
        skipped_candidates = [
            candidate
            for candidate in self.candidate_statuses
            if candidate["status"] == "placeholder-skipped"
        ]
        self.candidate_statuses = list(skipped_candidates)
        reasons = []
        for candidate in self._candidates:
            healthy, reason, models = self._probe_candidate(candidate)
            self.candidate_statuses.append({
                "source": candidate["source"],
                "status": reason,
            })
            if healthy:
                selected_model = self._installed_model_name(candidate["model"], models)
                self.selected_candidate = {
                    **candidate,
                    "model": selected_model,
                }
                self.host = candidate["url"]
                self.model = selected_model
                self.api_url = f"{self.host}/api/generate"
                self.available_models = models
                self.status = "connected"
                self.last_error = None
                return self.selected_candidate
            reasons.append(reason)

        if "model-not-installed" in reasons:
            self.status = "model-not-installed"
        elif reasons:
            self.status = reasons[-1]
        else:
            self.status = "ollama-unreachable"
        self.last_error = self.status
        raise OllamaUnavailableError(self.status)

    def check_connection(self) -> bool:
        try:
            self.discover(refresh=True)
            return True
        except OllamaUnavailableError:
            return False

    def get_available_models(self) -> List[str]:
        try:
            self.discover()
            return list(self.available_models)
        except OllamaUnavailableError:
            return []

    def generate_text(self, prompt: str, model: str = None) -> str:
        """Generate JSON-capable text; retain the legacy fallback with an explicit source."""
        try:
            candidate = self.discover()
            requested_model = resolve_env_value(model) if model else candidate["model"]
            if not requested_model:
                raise OllamaUnavailableError("model-not-installed")
            if requested_model != candidate["model"]:
                raise OllamaUnavailableError("model-not-installed")
            response = self.session.post(
                f"{candidate['url']}/api/generate",
                headers=self._request_headers(candidate["url"]),
                json={
                    "model": requested_model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.7, "top_p": 0.9},
                },
                timeout=300,
            )
            if response.status_code != 200:
                raise OllamaUnavailableError("ollama-unreachable")
            result = response.json()
            generated = result.get("response") if isinstance(result, dict) else None
            if not isinstance(generated, str) or not generated.strip():
                raise OllamaUnavailableError("ollama-unreachable")
            self.last_generation_source = "ollama"
            self.last_response = generated
            self.last_error = None
            return generated
        except OllamaUnavailableError as exc:
            self.last_generation_source = "fallback"
            self.last_error = exc.reason
            return self._generate_fallback_response(prompt)
        except (requests.exceptions.RequestException, ValueError):
            self.last_generation_source = "fallback"
            self.last_error = self.status if self.status != "connected" else "ollama-unreachable"
            return self._generate_fallback_response(prompt)

    def analyze_script_for_images(self, script_text: str, num_keyframes: int) -> List[Dict]:
        """Create keyframe prompts and preserve fallback provenance."""
        prompt = f"""
You are an engineering visualization content creator. Analyze the following script and create image generation prompts for {num_keyframes} keyframes.

Script: {script_text}

Return valid JSON in this shape:
{{"keyframes":[{{"scene_number":1,"description":"...","base_prompt":"...","infographic_prompt":"...","visual_elements":["..."],"engineering_concept":"..."}}]}}
"""
        response_text = self.generate_text(prompt)
        if self.last_generation_source != "ollama":
            self.last_analysis_source = "fallback"
            return self._generate_fallback_prompts(script_text, num_keyframes)
        try:
            result = json.loads(response_text)
            keyframes = result.get("keyframes") if isinstance(result, dict) else result
            if isinstance(keyframes, list) and len(keyframes) == num_keyframes:
                self.last_analysis_source = "ollama"
                return keyframes
        except (ValueError, TypeError):
            pass
        self.last_analysis_source = "fallback"
        return self._generate_fallback_prompts(script_text, num_keyframes)

    def organize_clip_sequence(self, clips_info: List[Dict]) -> List[Dict]:
        prompt = (
            "Organize these video clips in logical sequence. Return JSON with an "
            "'organized_clips' array containing original_index, new_position, and reason: "
            + json.dumps(clips_info, ensure_ascii=False)
        )
        try:
            result = json.loads(self.generate_text(prompt))
            clips = result.get("organized_clips") if isinstance(result, dict) else None
            if isinstance(clips, list) and clips and self.last_generation_source == "ollama":
                return clips
        except (ValueError, TypeError):
            pass
        self.last_generation_source = "fallback"
        return clips_info

    def enhance_script(self, script_text: str) -> str:
        return self.generate_text(
            "Analyze this engineering video script and suggest improvements:\n" + script_text
        )

    def _generate_fallback_response(self, prompt: str) -> str:
        return f"AI service unavailable. Fallback response for: {prompt[:50]}..."

    def _generate_fallback_prompts(self, script_text: str, num_keyframes: int) -> List[Dict]:
        return [
            {
                "scene_number": index + 1,
                "description": f"Scene {index + 1} for engineering visualization",
                "base_prompt": f"Engineering visualization scene {index + 1}, clean background, professional style",
                "infographic_prompt": f"Engineering visualization scene {index + 1} with detailed infographics and diagrams",
                "visual_elements": ["engineering elements", "technical diagrams"],
                "engineering_concept": "Engineering concept visualization",
                "source": "fallback",
            }
            for index in range(num_keyframes)
        ]

    def pull_model(self, model_name: str) -> bool:
        try:
            try:
                candidate = self.discover()
            except OllamaUnavailableError:
                candidate = None
                for configured_candidate in self._candidates:
                    healthy, reason, _models = self._probe_candidate(configured_candidate)
                    if healthy or reason == "model-not-installed":
                        candidate = configured_candidate
                        break
                if candidate is None:
                    return False
            response = self.session.post(
                f"{candidate['url']}/api/pull",
                json={"name": model_name, "stream": False},
                timeout=300,
            )
            return response.status_code == 200
        except (requests.exceptions.RequestException, OllamaUnavailableError):
            return False
