import unittest
from unittest.mock import Mock, patch

from scripts.verify_remote_services import verify_elevenlabs, verify_ollama


class RemoteServiceVerificationTests(unittest.TestCase):
    def test_ollama_requires_http_200_json_and_configured_model(self):
        response = Mock(status_code=200)
        response.json.return_value = {"models": [{"name": "llama3.2:latest"}]}
        session = Mock()
        session.get.return_value = response

        with patch("builtins.print") as output:
            self.assertTrue(
                verify_ollama("https://host.example///", "llama3.2", session)
            )

        session.get.assert_called_once_with(
            "https://host.example/api/tags",
            headers={},
            timeout=15,
        )
        output.assert_called_once_with("OLLAMA=http-200-json-model-verified")

    def test_ollama_does_not_report_success_for_invalid_json_shape(self):
        response = Mock(status_code=200)
        response.json.return_value = {"items": []}
        session = Mock()
        session.get.return_value = response

        with patch("builtins.print") as output:
            self.assertFalse(verify_ollama("https://host.example", "llama3.2", session))

        output.assert_called_once_with("OLLAMA=http-200-invalid-response")

    def test_elevenlabs_checks_voice_and_never_prints_credentials(self):
        key = "private-key-never-print"
        response = Mock(status_code=200)
        response.json.return_value = {"voices": [{"voice_id": "voice-123"}]}
        session = Mock()
        session.get.return_value = response

        with patch("builtins.print") as output:
            self.assertTrue(verify_elevenlabs(key, "voice-123", session))

        session.get.assert_called_once_with(
            "https://api.elevenlabs.io/v1/voices",
            headers={"xi-api-key": key, "Accept": "application/json"},
            timeout=15,
        )
        self.assertNotIn(key, repr(output.call_args))
        output.assert_called_once_with("ELEVENLABS=http-200-configured-voice-verified")

    def test_elevenlabs_401_is_not_reported_as_success(self):
        session = Mock()
        session.get.return_value = Mock(status_code=401)

        with patch("builtins.print") as output:
            self.assertFalse(verify_elevenlabs("private-key", "voice-123", session))

        self.assertNotIn("private-key", repr(output.call_args))
        output.assert_called_once_with("ELEVENLABS=http-401-invalid-response")


if __name__ == "__main__":
    unittest.main()
