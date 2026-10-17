import io
import os
import tempfile
import unittest
from unittest.mock import Mock, patch

from src.web_server import WebServer


class WebServerStorageAuthTests(unittest.TestCase):
    def make_server(self, temp_dir, auth_token=None):
        with patch.object(WebServer, '_init_services', lambda self: None):
            server = WebServer({
                'temp_dir': temp_dir,
                'secret_key': 'test-only-secret',
                'auth_token': auth_token,
            })
        server.auth_service = Mock(firebase_initialized=True)
        server.auth_service.verify_token.side_effect = lambda token: (
            {'success': True, 'user_id': 'user-1'}
            if token == 'valid-token'
            else {'success': False}
        )
        server.storage_service = Mock()
        server.storage_service.upload_file.return_value = {
            'success': True,
            'storage_path': 'users/user-1/uploads/photo.png',
        }
        server.ollama_service = Mock(
            last_generation_source='ollama',
            last_error=None,
            model='llama3.2:latest',
        )
        server.ollama_service.generate_text.return_value = 'generated'
        return server

    def test_storage_upload_requires_a_firebase_bearer_token(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            response = server.app.test_client().post(
                '/storage/upload',
                data={'file': (io.BytesIO(b'image'), 'photo.png')},
            )

        self.assertEqual(response.status_code, 401)
        server.storage_service.upload_file.assert_not_called()

    def test_storage_upload_rejects_other_users_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            response = server.app.test_client().post(
                '/storage/upload',
                headers={'Authorization': 'Bearer valid-token'},
                data={
                    'destination': 'videos/another-user/video.mp4',
                    'file': (io.BytesIO(b'video'), 'video.mp4'),
                },
            )

        self.assertEqual(response.status_code, 403)
        server.storage_service.upload_file.assert_not_called()

    def test_storage_upload_saves_to_a_temporary_name_and_cleans_it_up(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            observed = {}

            def inspect_upload(path, destination, metadata):
                observed['path'] = path
                observed['exists_during_upload'] = os.path.isfile(path)
                observed['destination'] = destination
                observed['metadata'] = metadata
                return {'success': True}

            server.storage_service.upload_file.side_effect = inspect_upload
            response = server.app.test_client().post(
                '/storage/upload',
                headers={'Authorization': 'Bearer valid-token'},
                data={'file': (io.BytesIO(b'image'), '../../photo.png')},
            )

            self.assertEqual(response.status_code, 200)
            self.assertTrue(observed['exists_during_upload'])
            self.assertTrue(observed['destination'].startswith('users/user-1/'))
            self.assertFalse(os.path.exists(observed['path']))

    def test_password_only_login_is_not_reported_as_authenticated(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            response = server.app.test_client().post(
                '/auth/login',
                json={'email': 'person@example.com', 'password': 'password'},
            )

        self.assertEqual(response.status_code, 400)
        server.auth_service.login_user.assert_not_called()

    def test_login_accepts_a_firebase_client_id_token(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            server.auth_service.login_user.return_value = {
                'success': True,
                'user_id': 'user-1',
            }
            response = server.app.test_client().post(
                '/auth/login',
                json={'id_token': 'firebase-id-token'},
            )

        self.assertEqual(response.status_code, 200)
        server.auth_service.login_user.assert_called_once_with('firebase-id-token')

    def test_storage_metadata_does_not_allow_access_to_another_user(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            response = server.app.test_client().get(
                '/storage/file/videos/another-user/video.mp4',
                headers={'Authorization': 'Bearer valid-token'},
            )

        self.assertEqual(response.status_code, 403)
        server.storage_service.get_file_info.assert_not_called()

    def test_ollama_endpoints_require_an_api_credential(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            response = server.app.test_client().post(
                '/ollama/generate',
                json={'prompt': 'generate'},
            )

        self.assertEqual(response.status_code, 401)
        server.ollama_service.generate_text.assert_not_called()

    def test_ollama_endpoints_accept_the_configured_service_token(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='test-service-token')
            response = server.app.test_client().post(
                '/ollama/generate',
                headers={'Authorization': 'Bearer test-service-token'},
                json={'prompt': 'generate'},
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()['success'])
        server.ollama_service.generate_text.assert_called_once_with('generate', None)


if __name__ == '__main__':
    unittest.main()
