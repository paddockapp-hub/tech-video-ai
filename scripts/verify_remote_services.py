"""Safely verify Ollama and the configured TTS provider or speech fallback."""

import sys
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import quote, urlsplit

import requests

try:
    from dotenv import load_dotenv
    from src.env_utils import get_env_value
    from src.ollama_service import OllamaService, OllamaUnavailableError
except ImportError:
    from env_utils import get_env_value
    from ollama_service import OllamaService, OllamaUnavailableError
    load_dotenv = None


def _valid_url(value: Optional[str]) -> bool:
    if not value:
        return False
    try:
        parsed = urlsplit(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.hostname) and not (
            parsed.username or parsed.password
        )
    except ValueError:
        return False


def verify_ollama(base_url: Optional[str], model: Optional[str], session=requests) -> bool:
    if not _valid_url(base_url) or not model:
        print("OLLAMA=not-configured")
        return False

    base_url = base_url.rstrip("/")
    headers = OllamaService._request_headers(base_url)
    parsed = urlsplit(base_url)
    if parsed.scheme == "https" and parsed.hostname.lower().endswith(".trycloudflare.com"):
        token = get_env_value("AUTH_TOKEN")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    try:
        response = session.get(f"{base_url}/api/tags", headers=headers, timeout=15)
        payload = response.json() if response.status_code == 200 else None
    except (requests.RequestException, ValueError):
        print("OLLAMA=unreachable")
        return False

    models = payload.get("models") if isinstance(payload, dict) else None
    if response.status_code != 200 or not isinstance(models, list):
        print(f"OLLAMA=http-{response.status_code}-invalid-response")
        return False

    installed_names = [
        item["name"]
        for item in models
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ]
    expected_names = {model}
    if ":" not in model:
        expected_names.add(f"{model}:latest")
    if not expected_names.intersection(installed_names):
        print("OLLAMA=http-200-model-not-installed")
        return False

    print("OLLAMA=http-200-json-model-verified")
    return True


def verify_elevenlabs(
    api_key: Optional[str],
    voice_id: Optional[str],
    session=requests,
) -> bool:
    if not api_key or not voice_id:
        print("ELEVENLABS=not-configured")
        return False

    try:
        response = session.get(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": api_key, "Accept": "application/json"},
            timeout=15,
        )
        payload = response.json() if response.status_code == 200 else None
    except (requests.RequestException, ValueError):
        print("ELEVENLABS=unreachable")
        return False

    voices = payload.get("voices") if isinstance(payload, dict) else None
    if response.status_code != 200 or not isinstance(voices, list):
        print(f"ELEVENLABS=http-{response.status_code}-invalid-response")
        return False
    if not any(
        isinstance(voice, dict) and voice.get("voice_id") == voice_id
        for voice in voices
    ):
        print("ELEVENLABS=http-200-voice-not-found")
        return False

    print("ELEVENLABS=http-200-configured-voice-verified")
    return True


def verify_gtts() -> bool:
    """Verify that the default no-key provider returns actual speech."""
    try:
        from src.tts_service import TTSService
    except ImportError:
        from tts_service import TTSService

    try:
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                "output_dir": directory,
                "temp_dir": directory,
                "tts_provider": "gtts",
            })
            service.generate_speech_from_script(
                "음성 생성 연결 확인",
                method="gtts",
            )
    except (OSError, RuntimeError):
        print("TTS=gtts-unavailable")
        return False

    if service.last_provider == "gtts" and not service.used_fallback:
        print("TTS=gtts-speech-verified")
        return True

    print("TTS=gtts-fallback-only")
    return False


def verify_google_image_provider(
    api_key: Optional[str],
    model: str,
    session=requests,
) -> bool:
    if not api_key:
        print("GOOGLE_IMAGE=local-renderer-only")
        return True

    encoded_model = quote(model, safe=".-_")
    try:
        response = session.get(
            f"https://generativelanguage.googleapis.com/v1beta/models/{encoded_model}",
            headers={"x-goog-api-key": api_key, "Accept": "application/json"},
            timeout=15,
        )
    except requests.Timeout:
        print("GOOGLE_IMAGE=timeout")
        return False
    except requests.RequestException:
        print("GOOGLE_IMAGE=unreachable")
        return False

    if response.status_code != 200:
        invalid_key = False
        if response.status_code == 400:
            try:
                error = response.json().get("error", {})
                invalid_key = (
                    isinstance(error, dict)
                    and error.get("status") == "INVALID_ARGUMENT"
                    and "api key not valid" in str(error.get("message", "")).lower()
                )
            except (AttributeError, ValueError):
                pass
        if response.status_code in (401, 403) or invalid_key:
            print("GOOGLE_IMAGE=unauthorized")
        elif response.status_code == 404:
            print("GOOGLE_IMAGE=model-not-found")
        elif response.status_code == 429:
            print("GOOGLE_IMAGE=rate-limited")
        else:
            print("GOOGLE_IMAGE=http-" + str(response.status_code))
        return False

    try:
        payload = response.json()
    except ValueError:
        print("GOOGLE_IMAGE=invalid-response")
        return False
    model_name = payload.get("name") if isinstance(payload, dict) else None
    supported = payload.get("supportedGenerationMethods", []) if isinstance(payload, dict) else []
    if (
        not isinstance(model_name, str)
        or model_name.split("/")[-1] != model
        or not isinstance(supported, list)
    ):
        print("GOOGLE_IMAGE=invalid-response")
        return False
    print("GOOGLE_IMAGE=api-key-and-model-verified")
    return True


def main() -> int:
    if load_dotenv:
        load_dotenv(Path(".env"), override=False)

    try:
        candidate = OllamaService().discover(refresh=True)
    except OllamaUnavailableError as error:
        print("OLLAMA=" + error.reason)
        ollama_ok = False
    else:
        ollama_ok = verify_ollama(candidate["url"], candidate["model"])
    provider = (get_env_value("TTS_PROVIDER") or "gtts").strip().lower()
    api_key = get_env_value("TTS_API_KEY") or get_env_value("apiKey")
    voice_id = get_env_value("TTS_VOICE")
    if provider in {"elevenlabs", "eleven-labs"} or (
        provider in {"auto", "default"} and api_key and voice_id
    ):
        tts_ok = verify_elevenlabs(api_key, voice_id)
        if not tts_ok:
            print("TTS_PRIMARY=unavailable; checking gTTS fallback")
            tts_ok = verify_gtts()
    elif provider in {"gtts", "auto", "default"}:
        tts_ok = verify_gtts()
    else:
        print("TTS=unsupported-verifier-provider")
        tts_ok = False

    image_model = get_env_value("GOOGLE_IMAGE_MODEL", "gemini-nano-banana-2.1")
    image_ok = verify_google_image_provider(
        get_env_value("GOOGLE_API_KEY") or get_env_value("GEMINI_API_KEY"),
        image_model or "gemini-nano-banana-2.1",
    )
    all_services_ok = ollama_ok and tts_ok and image_ok
    print("REMOTE_SERVICES=verified" if all_services_ok else "REMOTE_SERVICES=incomplete")
    return 0 if all_services_ok else 1


if __name__ == "__main__":
    sys.exit(main())
