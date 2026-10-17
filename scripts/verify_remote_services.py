"""Safely verify configured Ollama and ElevenLabs endpoints."""

import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit

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
    headers = {}
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
    elevenlabs_ok = verify_elevenlabs(
        get_env_value("TTS_API_KEY") or get_env_value("apiKey"),
        get_env_value("TTS_VOICE"),
    )
    print("REMOTE_SERVICES=verified" if ollama_ok and elevenlabs_ok else "REMOTE_SERVICES=incomplete")
    return 0 if ollama_ok and elevenlabs_ok else 1


if __name__ == "__main__":
    sys.exit(main())
