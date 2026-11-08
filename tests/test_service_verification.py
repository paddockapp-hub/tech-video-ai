import unittest
from unittest.mock import Mock, patch

from scripts.verify_remote_services import (
    main,
    verify_elevenlabs,
    verify_gtts,
    verify_google_image_provider,
    verify_ollama,
)


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

    def test_ollama_verifier_sends_access_service_token_headers(self):
        response = Mock(status_code=200)
        response.json.return_value = {"models": [{"name": "llama3.2:latest"}]}
        session = Mock()
        session.get.return_value = response
        environment = {
            "OLLAMA_BASE_URL": "https://ollama.example.com",
            "CF_ACCESS_CLIENT_ID": "service-client-id",
            "CF_ACCESS_CLIENT_SECRET": "service-client-secret",
        }

        with patch.dict("os.environ", environment, clear=True):
            with patch("builtins.print"):
                self.assertTrue(
                    verify_ollama(
                        "https://ollama.example.com",
                        "llama3.2:latest",
                        session,
                    )
                )

        session.get.assert_called_once_with(
            "https://ollama.example.com/api/tags",
            headers={
                "CF-Access-Client-Id": "service-client-id",
                "CF-Access-Client-Secret": "service-client-secret",
            },
            timeout=15,
        )

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

    @patch("src.tts_service.TTSService")
    def test_gtts_verification_requires_real_speech_not_fallback(self, service_class):
        service = service_class.return_value
        service.last_provider = "gtts"
        service.used_fallback = False

        with patch("builtins.print") as output:
            self.assertTrue(verify_gtts())

        service.generate_speech_from_script.assert_called_once_with(
            "음성 생성 연결 확인",
            method="gtts",
        )
        output.assert_called_once_with("TTS=gtts-speech-verified")

    def test_google_image_verification_does_not_require_a_key_for_local_art(self):
        with patch("builtins.print") as output:
            self.assertTrue(verify_google_image_provider(None, "gemini-nano-banana-2.1"))

        output.assert_called_once_with("GOOGLE_IMAGE=local-renderer-only")

    def test_google_image_verification_reports_invalid_key_without_leaking_it(self):
        response = Mock(status_code=400)
        response.json.return_value = {
            "error": {
                "status": "INVALID_ARGUMENT",
                "message": "API key not valid. Please pass a valid API key.",
            }
        }
        session = Mock()
        session.get.return_value = response
        key = "private-google-key"

        with patch("builtins.print") as output:
            self.assertFalse(verify_google_image_provider(key, "gemini-nano-banana-2.1", session))

        session.get.assert_called_once_with(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-nano-banana-2.1",
            headers={"x-goog-api-key": key, "Accept": "application/json"},
            timeout=15,
        )
        self.assertNotIn(key, repr(output.call_args))
        output.assert_called_once_with("GOOGLE_IMAGE=unauthorized")

    def test_google_image_verification_checks_configured_model_resource(self):
        response = Mock(status_code=200)
        response.json.return_value = {
            "name": "models/gemini-nano-banana-2.1",
            "supportedGenerationMethods": ["generateContent"],
        }
        session = Mock()
        session.get.return_value = response

        with patch("builtins.print") as output:
            self.assertTrue(
                verify_google_image_provider("private-google-key", "gemini-nano-banana-2.1", session)
            )

        output.assert_called_once_with("GOOGLE_IMAGE=api-key-and-model-verified")

    @patch("scripts.verify_remote_services.verify_gtts", return_value=True)
    @patch("scripts.verify_remote_services.verify_elevenlabs")
    @patch("scripts.verify_remote_services.verify_ollama", return_value=True)
    @patch("scripts.verify_remote_services.OllamaService")
    def test_main_uses_highest_priority_discovered_candidate(
        self,
        service_class,
        verify_ollama_mock,
        verify_elevenlabs_mock,
        verify_gtts_mock,
    ):
        service_class.return_value.discover.return_value = {
            "url": "https://newest.trycloudflare.com",
            "model": "llama3.2:latest",
        }
        with patch.dict("os.environ", {}, clear=True), patch(
            "scripts.verify_remote_services.load_dotenv", None
        ), patch("builtins.print"):
            self.assertEqual(main(), 0)

        verify_ollama_mock.assert_called_once_with(
            "https://newest.trycloudflare.com",
            "llama3.2:latest",
        )
        verify_elevenlabs_mock.assert_not_called()
        verify_gtts_mock.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
