import threading
import unittest
from http.server import ThreadingHTTPServer
from unittest.mock import Mock, patch

import requests

from src.ollama_service import OllamaService
from src.ollama_tunnel import OllamaTunnelHandler


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


if __name__ == "__main__":
    unittest.main()
