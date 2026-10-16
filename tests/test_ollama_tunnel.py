import threading
import unittest
import tempfile
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import Mock, patch

import requests

from dotenv import dotenv_values
from src.ollama_service import OllamaService
from src.ollama_tunnel import OllamaTunnelHandler
from scripts.prepare_preview import prepare_preview


class OllamaTunnelTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), OllamaTunnelHandler)
        self.server.auth_token = "t" * 48
        self.server.model_name = "llama3.2:latest"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base_url = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)

    def test_gateway_rejects_missing_or_invalid_authentication(self):
        for headers in ({}, {"Authorization": "Bearer wrong"}):
            response = requests.get(
                f"{self.base_url}/api/version",
                headers=headers,
                timeout=2,
            )
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.json(), {"error": "Unauthorized"})

    @patch("src.ollama_tunnel.requests.request")
    def test_gateway_proxies_only_authenticated_ollama_routes(self, request):
        upstream = Mock(status_code=200)
        upstream.headers = {"Content-Type": "application/json"}
        upstream.iter_content.return_value = [b'{"version":"0.5.0"}']
        request.return_value = upstream

        response = requests.get(
            f"{self.base_url}/api/version",
            headers={"Authorization": "Bearer " + self.server.auth_token},
            timeout=2,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"version": "0.5.0"})
        request.assert_called_once()
        self.assertEqual(request.call_args.args[:2], ("GET", "http://127.0.0.1:11434/api/version"))

        rejected_generation = requests.post(
            f"{self.base_url}/api/generate",
            headers={"Authorization": "Bearer " + self.server.auth_token},
            json={"model": "uninstalled-model", "stream": False},
            timeout=2,
        )
        self.assertEqual(rejected_generation.status_code, 400)

        blocked = requests.get(
            f"{self.base_url}/",
            headers={"Authorization": "Bearer " + self.server.auth_token},
            timeout=2,
        )
        self.assertEqual(blocked.status_code, 404)
        self.assertEqual(request.call_count, 1)

    def test_client_sends_auth_only_to_cloudflare_quick_tunnel_hosts(self):
        with patch.dict("os.environ", {"AUTH_TOKEN": "private-app-token"}, clear=False):
            self.assertEqual(
                OllamaService._request_headers("https://random.trycloudflare.com"),
                {"Authorization": "Bearer private-app-token"},
            )
            self.assertEqual(
                OllamaService._request_headers("https://untrusted.example.net"),
                {},
            )
            self.assertEqual(
                OllamaService._request_headers("http://localhost:11434"),
                {},
            )

    @patch("scripts.prepare_preview.secrets.token_urlsafe", return_value="generated-token")
    @patch("scripts.prepare_preview._verify_local_ollama", return_value="llama3.2:latest")
    def test_preview_setup_saves_local_values_and_copies_them_without_printing_secrets(
        self,
        _verify_ollama,
        _make_token,
    ):
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            copied = []

            def run_tunnel(token, model, on_tunnel_url):
                self.assertEqual(token, "generated-token")
                self.assertEqual(model, "llama3.2:latest")
                on_tunnel_url("https://test.trycloudflare.com")
                return 0

            with patch("builtins.print") as output:
                result = prepare_preview(
                    "test-api-key",
                    "test-voice-id",
                    env_path=env_path,
                    tunnel_runner=run_tunnel,
                    clipboard_writer=copied.append,
                )

            saved = dotenv_values(env_path)
            self.assertEqual(result, 0)
            self.assertEqual(saved["AUTH_TOKEN"], "generated-token")
            self.assertEqual(saved["TTS_API_KEY"], "test-api-key")
            self.assertEqual(saved["TTS_VOICE"], "test-voice-id")
            self.assertEqual(saved["OLLAMA_BASE_URL"], "https://test.trycloudflare.com")
            self.assertEqual(len(copied), 1)
            self.assertIn("OLLAMA_BASE_URL=https://test.trycloudflare.com", copied[0])
            self.assertIn("TTS_PROVIDER=elevenlabs", copied[0])
            self.assertIn("TTS_API_KEY=test-api-key", copied[0])
            self.assertIn("AUTH_TOKEN=generated-token", copied[0])
            self.assertNotIn("test-api-key", repr(output.call_args_list))
            self.assertNotIn("generated-token", repr(output.call_args_list))


if __name__ == "__main__":
    unittest.main()
