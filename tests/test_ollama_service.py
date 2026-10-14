import os
import unittest
from unittest.mock import patch

import requests

from src.env_utils import get_env_value
from src.ollama_service import OllamaService


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text='{}', content_type='application/json'):
        self.status_code = status_code
        self._payload = payload
        self.text = text
        self.headers = {'Content-Type': content_type}

    def json(self):
        if self._payload is None:
            raise ValueError('invalid JSON')
        return self._payload


class FakeSession:
    def __init__(self, get_responses=None, post_response=None):
        self.get_responses = list(get_responses or [])
        self.post_response = post_response
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append(('GET', url, kwargs))
        return self.get_responses.pop(0)

    def post(self, url, **kwargs):
        self.calls.append(('POST', url, kwargs))
        return self.post_response


class OllamaServiceTests(unittest.TestCase):
    def tags_response(self, name='llama3.2'):
        return FakeResponse(payload={'models': [{'name': name}]})

    def test_default_model_matches_ollama_latest_tag(self):
        with patch.dict(os.environ, {}, clear=True):
            service = OllamaService()

        self.assertEqual(service._candidates[0]['model'], 'llama3.2:latest')

    def test_prioritized_candidate_is_selected_and_generation_uses_json_format(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://priority.ngrok-free.dev///',
            'OLLAMA_MODEL_8_3_2': 'llama3.2',
            'OLLAMA_HOST': 'http://fallback.ngrok-free.dev',
            'OLLAMA_MODEL': 'other-model',
        }
        session = FakeSession(
            get_responses=[
                FakeResponse(payload={'version': '0.5.0'}),
                self.tags_response(),
            ],
            post_response=FakeResponse(payload={'response': '{"keyframes": []}'}),
        )
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(session=session)
            result = service.generate_text('produce JSON')

        self.assertEqual(result, '{"keyframes": []}')
        self.assertEqual(service.host, 'https://priority.ngrok-free.dev')
        self.assertEqual(service.last_generation_source, 'ollama')
        post = next(call for call in session.calls if call[0] == 'POST')
        self.assertEqual(post[1], 'https://priority.ngrok-free.dev/api/generate')
        self.assertEqual(post[2]['json']['format'], 'json')
        self.assertFalse(post[2]['json']['stream'])
        self.assertEqual([call[1].rsplit('/', 1)[-1] for call in session.calls[:2]], ['version', 'tags'])

    def test_unqualified_model_alias_uses_installed_latest_tag_for_generation(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://priority.ngrok-free.dev',
            'OLLAMA_MODEL_8_3_2': 'llama3.2',
        }
        session = FakeSession(
            get_responses=[
                FakeResponse(payload={'version': '0.5.0'}),
                self.tags_response(name='llama3.2:latest'),
            ],
            post_response=FakeResponse(payload={'response': 'OK'}),
        )
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(session=session)
            result = service.generate_text('produce one word')

        post = next(call for call in session.calls if call[0] == 'POST')
        self.assertEqual(result, 'OK')
        self.assertEqual(service.selected_candidate['model'], 'llama3.2:latest')
        self.assertEqual(post[2]['json']['model'], 'llama3.2:latest')

    def test_wrong_installed_model_is_not_used(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://wrong.ngrok-free.dev',
            'OLLAMA_MODEL_8_3_2': 'expected',
        }
        session = FakeSession(get_responses=[
            FakeResponse(payload={'version': '0.5.0'}),
            self.tags_response(name='other'),
        ])
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(host='', model='', session=session)
            self.assertFalse(service.check_connection())

        self.assertEqual(service.status, 'model-not-installed')

    def test_non_200_generation_response_is_labeled_as_fallback(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://ollama.ngrok-free.dev',
            'OLLAMA_MODEL_8_3_2': 'llama3.2',
        }
        session = FakeSession(
            get_responses=[
                FakeResponse(payload={'version': '0.5.0'}),
                self.tags_response(),
            ],
            post_response=FakeResponse(status_code=500),
        )
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(session=session)
            response = service.generate_text('prompt')

        self.assertTrue(response.startswith('AI service unavailable.'))
        self.assertEqual(service.last_generation_source, 'fallback')
        self.assertEqual(service.last_error, 'ollama-unreachable')

    def test_html_tunnel_response_is_classified_without_printing_response_body(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://tunnel.ngrok-free.dev',
            'OLLAMA_MODEL_8_3_2': 'llama3.2',
        }
        session = FakeSession(get_responses=[
            FakeResponse(text='<html>tunnel</html>', content_type='text/html'),
            FakeResponse(text='<html>tunnel</html>', content_type='text/html'),
        ])
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(host='', model='', session=session)
            self.assertFalse(service.check_connection())

        self.assertEqual(service.status, 'tunnel-not-ollama')

    def test_404_and_connection_failures_use_their_distinct_statuses(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://not-ollama.ngrok-free.dev',
            'OLLAMA_MODEL_8_3_2': 'llama3.2',
        }
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(
                host='',
                model='',
                session=FakeSession(get_responses=[
                    FakeResponse(status_code=404),
                    FakeResponse(status_code=404),
                ]),
            )
            self.assertFalse(service.check_connection())
            self.assertEqual(service.status, 'tunnel-not-ollama')

            class RefusedSession:
                def get(self, _url, **_kwargs):
                    raise requests.exceptions.ConnectionError()

            service = OllamaService(host='', model='', session=RefusedSession())
            self.assertFalse(service.check_connection())
            self.assertEqual(service.status, 'ollama-unreachable')

    def test_environment_references_are_resolved_recursively_and_cycles_are_rejected(self):
        environment = {
            'FIRST': 'process.env.SECOND',
            'SECOND': 'process.env.THIRD',
            'THIRD': 'resolved-value',
            'INLINE': 'https://service.example/models/process.env.THIRD?again=process.env.THIRD',
            'CYCLE_A': 'process.env.CYCLE_B',
            'CYCLE_B': 'process.env.CYCLE_A',
        }
        with patch.dict(os.environ, environment, clear=True):
            self.assertEqual(get_env_value('FIRST'), 'resolved-value')
            self.assertEqual(
                get_env_value('INLINE'),
                'https://service.example/models/resolved-value?again=resolved-value',
            )
            self.assertIsNone(get_env_value('CYCLE_A'))

    def test_placeholder_urls_are_skipped_without_network_requests(self):
        environment = {
            'OLLAMA_BASE_URL_10_3_2': 'https://abc123.ngrok-free.app',
            'OLLAMA_MODEL_8_3_2': 'llama3.2',
            'OLLAMA_BASE_URL_9': 'https://your-domain.com',
            'OLLAMA_MODEL_9': 'llama3.2',
        }
        session = FakeSession()
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(host='', model='', session=session)

        self.assertEqual(service._candidates, [])
        self.assertEqual(len(service.candidate_statuses), 2)
        self.assertTrue(all(item['status'] == 'placeholder-skipped' for item in service.candidate_statuses))
        self.assertEqual(session.calls, [])

    def test_model_nine_process_env_reference_is_resolved_and_paired(self):
        environment = {
            'OLLAMA_BASE_URL_9': 'https://ollama-nine.ngrok-free.dev',
            'OLLAMA_MODEL_9': 'process.env.ACTUAL_OLLAMA_MODEL',
            'ACTUAL_OLLAMA_MODEL': 'llama3.2',
        }
        with patch.dict(os.environ, environment, clear=True):
            service = OllamaService(host='', model='', session=FakeSession())

        self.assertEqual(service._candidates[0]['source'], 'OLLAMA_BASE_URL_9+OLLAMA_MODEL_9')
        self.assertEqual(service._candidates[0]['model'], 'llama3.2')


if __name__ == '__main__':
    unittest.main()
