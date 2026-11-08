"""Prepare local Ollama and copy Preview environment variables to the clipboard."""

import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Optional

from dotenv import load_dotenv, set_key

from src.env_utils import get_env_value
from src.ollama_tunnel import _run_cloudflared, _verify_local_ollama


ENV_PATH = Path(".env")


def _save_env_values(path: Path, values: Dict[str, str]) -> None:
    for name, value in values.items():
        set_key(str(path), name, value, quote_mode="always")
        os.environ[name] = value


def _preview_env_text(public_url: str, values: Dict[str, str]) -> str:
    entries = {
        "OLLAMA_BASE_URL": public_url,
        "OLLAMA_MODEL": values["OLLAMA_MODEL"],
        "OLLAMA_BASE_URL_14": public_url,
        "OLLAMA_MODEL_13": values["OLLAMA_MODEL"],
        "TTS_PROVIDER": values["TTS_PROVIDER"],
        "TTS_LANGUAGE": values["TTS_LANGUAGE"],
        "AUTH_TOKEN": values["AUTH_TOKEN"],
    }
    if values["TTS_PROVIDER"] == "elevenlabs":
        entries["TTS_API_KEY"] = values["TTS_API_KEY"]
        entries["TTS_VOICE"] = values["TTS_VOICE"]
    return "\n".join(f"{name}={value}" for name, value in entries.items()) + "\n"


def _copy_to_windows_clipboard(text: str) -> None:
    try:
        subprocess.run(
            ["clip.exe"],
            input=text,
            text=True,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        raise RuntimeError("Could not copy Preview variables to the Windows clipboard.") from None


def prepare_preview(
    tts_api_key: Optional[str] = None,
    tts_voice: Optional[str] = None,
    *,
    env_path: Path = ENV_PATH,
    tunnel_runner=_run_cloudflared,
    clipboard_writer=_copy_to_windows_clipboard,
) -> int:
    api_key = (tts_api_key or get_env_value("TTS_API_KEY") or get_env_value("apiKey") or "").strip()
    voice_id = (tts_voice or get_env_value("TTS_VOICE") or "").strip()
    if bool(api_key) != bool(voice_id):
        raise ValueError("Configure both the ElevenLabs API key and voice ID, or configure neither to use gTTS.")
    tts_provider = "elevenlabs" if api_key and voice_id else "gtts"
    tts_language = get_env_value("TTS_LANGUAGE", "ko-KR") or "ko-KR"

    model = get_env_value("OLLAMA_MODEL", "llama3.2:latest") or "llama3.2:latest"
    verified_model = _verify_local_ollama(model)
    auth_token = secrets.token_urlsafe(48)
    values = {
        "AUTH_TOKEN": auth_token,
        "OLLAMA_MODEL": verified_model,
        "TTS_PROVIDER": tts_provider,
        "TTS_LANGUAGE": tts_language,
    }
    if tts_provider == "elevenlabs":
        values["TTS_API_KEY"] = api_key
        values["TTS_VOICE"] = voice_id
    _save_env_values(env_path, values)

    def copy_preview_values(public_url: str) -> None:
        values["OLLAMA_BASE_URL"] = public_url
        _save_env_values(
            env_path,
            {
                "OLLAMA_BASE_URL": public_url,
                "OLLAMA_BASE_URL_14": public_url,
                "OLLAMA_MODEL_13": verified_model,
                "TTS_PROVIDER": tts_provider,
                "TTS_LANGUAGE": tts_language,
            },
        )
        clipboard_writer(_preview_env_text(public_url, values))
        print(
            f"Preview variables copied to clipboard with {tts_provider} TTS. Paste them into the Vercel Preview environment.",
            flush=True,
        )

    return tunnel_runner(auth_token, verified_model, copy_preview_values)


def main() -> int:
    load_dotenv(ENV_PATH, override=False)
    if os.name != "nt":
        print("This setup command must run on the Windows Ollama host.", file=sys.stderr)
        return 2
    if not shutil.which("cloudflared"):
        print("cloudflared is not installed or is not on PATH.", file=sys.stderr)
        return 2

    model = get_env_value("OLLAMA_MODEL", "llama3.2:latest") or "llama3.2:latest"
    try:
        _verify_local_ollama(model)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    try:
        return prepare_preview()
    except (OSError, RuntimeError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
