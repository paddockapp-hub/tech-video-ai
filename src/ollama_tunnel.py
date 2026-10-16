"""Authenticated local gateway for exposing Ollama through a Cloudflare tunnel."""

import hmac
import json
import os
import re
import shutil
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Callable, Optional
from urllib.parse import urlsplit

import requests

try:
    from dotenv import load_dotenv
    from .env_utils import get_env_value
except ImportError:
    from env_utils import get_env_value
    load_dotenv = None


OLLAMA_URL = "http://127.0.0.1:11434"
GATEWAY_HOST = "127.0.0.1"
GATEWAY_PORT = 11435
ALLOWED_ROUTES = {
    ("GET", "/api/version"),
    ("GET", "/api/tags"),
    ("POST", "/api/generate"),
}
MAX_REQUEST_BYTES = 16 * 1024 * 1024
MAX_RESPONSE_BYTES = 4 * 1024 * 1024
TUNNEL_URL_PATTERN = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


class OllamaTunnelHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "OllamaGateway"
    sys_version = ""

    def log_message(self, _format, *_args):
        return

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        expected = self.server.auth_token
        scheme, separator, supplied = self.headers.get("Authorization", "").partition(" ")
        return (
            bool(expected)
            and separator == " "
            and scheme.lower() == "bearer"
            and hmac.compare_digest(supplied.strip(), expected)
        )

    def _forward(self) -> None:
        if not self._authorized():
            self._send_json(401, {"error": "Unauthorized"})
            return

        route = (self.command, urlsplit(self.path).path)
        if route not in ALLOWED_ROUTES or self.path != route[1]:
            self._send_json(404, {"error": "Not found"})
            return

        content_length = 0
        if self.command == "POST":
            try:
                content_length = int(self.headers.get("Content-Length", ""))
            except ValueError:
                self._send_json(400, {"error": "Invalid content length"})
                return
            if content_length < 0 or content_length > MAX_REQUEST_BYTES:
                self._send_json(413, {"error": "Request too large"})
                return

        body = self.rfile.read(content_length) if content_length else None
        if route == ("POST", "/api/generate"):
            try:
                payload = json.loads(body or b"")
            except (TypeError, ValueError):
                self._send_json(400, {"error": "Invalid JSON"})
                return
            if (
                not isinstance(payload, dict)
                or payload.get("model") != self.server.model_name
                or payload.get("stream") is not False
            ):
                self._send_json(400, {"error": "Unsupported generation request"})
                return

        try:
            upstream = requests.request(
                self.command,
                f"{OLLAMA_URL}{route[1]}",
                data=body,
                headers={
                    "Content-Type": self.headers.get("Content-Type", "application/json"),
                    "Accept-Encoding": "identity",
                },
                timeout=(5, 600),
                stream=True,
            )
        except requests.RequestException:
            self._send_json(502, {"error": "Ollama unavailable"})
            return

        try:
            response_body = bytearray()
            for chunk in upstream.iter_content(chunk_size=64 * 1024):
                if chunk:
                    response_body.extend(chunk)
                    if len(response_body) > MAX_RESPONSE_BYTES:
                        self._send_json(502, {"error": "Ollama response too large"})
                        return
            content_type = upstream.headers.get("Content-Type", "application/json")
            self.send_response(upstream.status_code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(response_body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(response_body)
        except (OSError, requests.RequestException):
            return
        finally:
            upstream.close()

    def do_GET(self):
        self._forward()

    def do_POST(self):
        self._forward()


def _verify_local_ollama(model: str) -> str:
    try:
        version = requests.get(f"{OLLAMA_URL}/api/version", timeout=5)
        tags = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        version.raise_for_status()
        tags.raise_for_status()
        version_payload = version.json()
        payload = tags.json()
    except (requests.RequestException, ValueError):
        raise RuntimeError("Local Ollama did not return valid version and model responses.") from None

    if not isinstance(version_payload, dict) or not isinstance(version_payload.get("version"), str):
        raise RuntimeError("Local Ollama returned an invalid version response.")
    installed = payload.get("models") if isinstance(payload, dict) else None
    names = [
        item["name"]
        for item in installed or []
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ]
    expected = model if ":" in model or f"{model}:latest" not in names else f"{model}:latest"
    if not isinstance(installed, list) or expected not in names:
        raise RuntimeError("Configured Ollama model is not installed locally.")
    return expected


def _run_cloudflared(
    auth_token: str,
    model_name: str,
    on_tunnel_url: Optional[Callable[[str], None]] = None,
) -> int:
    executable = shutil.which("cloudflared")
    if not executable:
        raise RuntimeError(
            "cloudflared is not installed. Install Cloudflare Tunnel, reopen PowerShell, and run this command again."
        )

    server = ThreadingHTTPServer((GATEWAY_HOST, GATEWAY_PORT), OllamaTunnelHandler)
    server.auth_token = auth_token
    server.model_name = model_name
    threading.Thread(target=server.serve_forever, daemon=True).start()

    process = None
    public_url: Optional[str] = None
    try:
        process = subprocess.Popen(
            [
                executable,
                "tunnel",
                "--url",
                f"http://{GATEWAY_HOST}:{GATEWAY_PORT}",
                "--no-autoupdate",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        if process.stdout is None:
            raise RuntimeError("Cloudflare Tunnel output is unavailable.")
        for line in process.stdout:
            match = TUNNEL_URL_PATTERN.search(line)
            if match and not public_url:
                public_url = match.group(0)
                print(f"OLLAMA_TUNNEL_URL={public_url}", flush=True)
                if on_tunnel_url:
                    on_tunnel_url(public_url)
                print("Ollama tunnel is active; keep this process running.", flush=True)
        return process.wait()
    except KeyboardInterrupt:
        return 0
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        server.shutdown()
        server.server_close()
        if not public_url:
            print("Cloudflare Tunnel exited before publishing a URL.", file=sys.stderr)


def main() -> int:
    if load_dotenv:
        load_dotenv(override=False)

    token = get_env_value("AUTH_TOKEN")
    if not token or len(token) < 32:
        print(
            "AUTH_TOKEN must be configured with at least 32 characters, and the same value must be available to the remote Ollama client.",
            file=sys.stderr,
        )
        return 2

    model = get_env_value("OLLAMA_MODEL", "llama3.2:latest") or "llama3.2:latest"
    try:
        verified_model = _verify_local_ollama(model)
        return _run_cloudflared(token, verified_model)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
