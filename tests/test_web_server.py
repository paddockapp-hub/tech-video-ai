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
                'output_dir': os.path.join(temp_dir, 'output'),
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
        server.storage_service.storage_type = 'local'
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

    def test_srt_timestamps_are_formatted_as_milliseconds(self):
        self.assertEqual(
            WebServer._format_srt_timestamp(61.2349),
            '00:01:01,235',
        )

    def test_video_generation_requires_api_credential(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            server.video_generator_class = Mock()
            response = server.app.test_client().post(
                '/api/generate',
                json={'title': 'Test video', 'idea': 'This is a sufficiently long script.'},
            )

        self.assertEqual(response.status_code, 401)
        server.video_generator_class.assert_not_called()

    def test_studio_page_is_served_by_the_flask_app(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory)
            response = server.app.test_client().get('/')

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'/api/generate', response.data)
        response.close()

    def test_video_generation_validates_title_and_script_before_running(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='service-token')
            server.video_generator_class = Mock()
            response = server.app.test_client().post(
                '/api/generate',
                headers={'Authorization': 'Bearer service-token'},
                json={'title': ' ', 'idea': 'This is a sufficiently long script.'},
            )

        self.assertEqual(response.status_code, 400)
        server.video_generator_class.assert_not_called()

    def test_video_generation_returns_playable_asset_and_audio_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='service-token')
            server.storage_service.storage_type = 'vercel'
            server.storage_service.upload_file.return_value = {
                'success': True,
                'storage_type': 'vercel',
                'storage_path': 'videos/web/job.mp4',
            }
            observed = {}

            class Generator:
                def __init__(self, config_override):
                    self.config = config_override

                def generate_full_video(self, script_path):
                    with open(script_path, encoding='utf-8') as script_file:
                        observed['script'] = script_file.read()
                    os.makedirs(self.config['output_dir'], exist_ok=True)
                    video_path = os.path.join(self.config['output_dir'], 'final.mp4')
                    with open(video_path, 'wb') as video_file:
                        video_file.write(b'\x00\x00\x00\x18ftypisommock-mp4')
                    return {
                        'success': True,
                        'status': 'completed_with_fallback',
                        'video_file': video_path,
                        'audio_provider': 'synthetic-fallback',
                        'audio_used_fallback': True,
                        'audio_error': 'gtts-unavailable',
                        'image_result': {
                            'ai_source': 'fallback',
                            'ai_error': 'ollama-unreachable',
                            'image_source': 'local-renderer',
                            'image_error': 'image-provider-unauthorized',
                        },
                        'visual_source': 'scene-artwork-with-parallax',
                        'subtitles': [{
                            'text': '테스트 자막',
                            'start': 0.0,
                            'end': 1.25,
                        }],
                        'subtitles_burned_in': True,
                        'subtitle_timing': 'estimated-from-script-length',
                    }

            server.video_generator_class = Generator
            client = server.app.test_client()
            response = client.post(
                '/api/generate',
                headers={'Authorization': 'Bearer service-token'},
                json={
                    'title': 'Test video',
                    'idea': 'This is a sufficiently long script.',
                },
            )

            payload = response.get_json()
            self.assertEqual(response.status_code, 200)
            self.assertTrue(payload['success'])
            self.assertEqual(payload['audio_provider'], 'synthetic-fallback')
            self.assertTrue(payload['audio_used_fallback'])
            self.assertEqual(payload['audio_error'], 'gtts-unavailable')
            self.assertEqual(payload['ai_source'], 'fallback')
            self.assertEqual(payload['ai_error'], 'ollama-unreachable')
            self.assertEqual(payload['image_source'], 'local-renderer')
            self.assertEqual(payload['image_error'], 'image-provider-unauthorized')
            self.assertEqual(payload['storage_status'], 'uploaded')
            self.assertEqual(
                payload['visual_source'],
                'scene-artwork-with-parallax',
            )
            self.assertTrue(payload['subtitles_burned_in'])
            self.assertEqual(
                payload['subtitle_timing'],
                'estimated-from-script-length',
            )
            server.storage_service.upload_file.assert_called_once()
            self.assertIn('# Test video', observed['script'])

            video_response = client.get(payload['video_url'])
            self.assertEqual(video_response.status_code, 200)
            self.assertEqual(video_response.mimetype, 'video/mp4')
            self.assertEqual(video_response.headers['Cache-Control'], 'private, no-store')
            self.assertTrue(video_response.data.startswith(b'\x00\x00\x00\x18ftyp'))
            video_response.close()

            subtitle_response = client.get(payload['subtitles_url'])
            self.assertEqual(subtitle_response.status_code, 200)
            self.assertIn('00:00:00,000 --> 00:00:01,250', subtitle_response.get_data(as_text=True))
            self.assertIn('테스트 자막', subtitle_response.get_data(as_text=True))
            subtitle_response.close()
            caption_response = client.get(payload['caption_url'])
            self.assertEqual(caption_response.status_code, 200)
            self.assertIn('Test video', caption_response.get_data(as_text=True))
            caption_response.close()
    def test_video_generation_rejects_non_mp4_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='service-token')

            class Generator:
                def __init__(self, config_override):
                    self.config = config_override

                def generate_full_video(self, _script_path):
                    os.makedirs(self.config['output_dir'], exist_ok=True)
                    video_path = os.path.join(self.config['output_dir'], 'not-video.mp4')
                    with open(video_path, 'wb') as video_file:
                        video_file.write(b'not an mp4')
                    return {'success': True, 'video_file': video_path}

            server.video_generator_class = Generator
            response = server.app.test_client().post(
                '/api/generate',
                headers={'Authorization': 'Bearer service-token'},
                json={
                    'title': 'Test video',
                    'idea': 'This is a sufficiently long script.',
                },
            )

        self.assertEqual(response.status_code, 502)
        self.assertFalse(response.get_json()['success'])
        self.assertEqual(response.get_json()['status'], 'failed')
        self.assertEqual(server.generated_videos, {})

    def test_remote_storage_failure_keeps_video_available_with_fallback_status(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='service-token')
            server.storage_service.storage_type = 'vercel'
            server.storage_service.upload_file.return_value = {
                'success': False,
                'error': 'provider details must not reach the API response',
            }

            class Generator:
                def __init__(self, config_override):
                    self.config = config_override

                def generate_full_video(self, _script_path):
                    os.makedirs(self.config['output_dir'], exist_ok=True)
                    video_path = os.path.join(self.config['output_dir'], 'final.mp4')
                    with open(video_path, 'wb') as video_file:
                        video_file.write(b'\x00\x00\x00\x18ftypisommock-mp4')
                    return {
                        'success': True,
                        'video_file': video_path,
                        'audio_provider': 'gtts',
                        'audio_used_fallback': False,
                    }

            server.video_generator_class = Generator
            client = server.app.test_client()
            response = client.post(
                '/api/generate',
                headers={'Authorization': 'Bearer service-token'},
                json={
                    'title': 'Test video',
                    'idea': 'This is a sufficiently long script.',
                },
            )
            payload = response.get_json()

            self.assertEqual(response.status_code, 200)
            self.assertTrue(payload['success'])
            self.assertEqual(payload['status'], 'completed_with_fallback')
            self.assertEqual(payload['storage_status'], 'saved-locally-fallback')
            self.assertTrue(payload['storage_fallback_used'])
            self.assertEqual(payload['storage_error'], 'storage-upload-failed')
            self.assertNotIn('provider details', response.get_data(as_text=True))
            video_response = client.get(payload['video_url'])
            self.assertEqual(video_response.status_code, 200)
            video_response.close()

    def test_vercel_generation_returns_durable_video_and_artifact_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='service-token')
            server.config['require_persistent_storage'] = True
            server.storage_service.storage_type = 'vercel'
            upload_count = 0

            def upload_file(_path, destination, _metadata):
                nonlocal upload_count
                upload_count += 1
                return {
                    'success': True,
                    'storage_type': 'vercel',
                    'storage_path': destination,
                    'file_url': f'https://blob.example/{upload_count}',
                }

            server.storage_service.upload_file.side_effect = upload_file

            class Generator:
                def __init__(self, config_override):
                    self.config = config_override

                def generate_full_video(self, _script_path):
                    os.makedirs(self.config['output_dir'], exist_ok=True)
                    video_path = os.path.join(self.config['output_dir'], 'final.mp4')
                    with open(video_path, 'wb') as video_file:
                        video_file.write(b'\x00\x00\x00\x18ftypisommock-mp4')
                    return {
                        'success': True,
                        'video_file': video_path,
                        'subtitles': [{'text': 'Test subtitle', 'start': 0, 'end': 1}],
                    }

            server.video_generator_class = Generator
            response = server.app.test_client().post(
                '/api/generate',
                headers={
                    'Authorization': 'Bearer ' + '-'.join(('valid', 'token')),
                },
                json={
                    'title': 'Test video',
                    'idea': 'This is a sufficiently long script.',
                },
            )
            payload = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload['success'])
        self.assertEqual(payload['status'], 'completed')
        self.assertEqual(payload['video_url'], 'https://blob.example/1')
        self.assertEqual(payload['subtitles_url'], 'https://blob.example/2')
        self.assertEqual(payload['caption_url'], 'https://blob.example/3')
        self.assertEqual(upload_count, 3)

    def test_required_persistent_storage_failure_does_not_report_completion(self):
        with tempfile.TemporaryDirectory() as directory:
            server = self.make_server(directory, auth_token='service-token')
            server.config['require_persistent_storage'] = True
            server.storage_service.storage_type = 'vercel'
            server.storage_service.upload_file.return_value = {'success': False}

            class Generator:
                def __init__(self, config_override):
                    self.config = config_override

                def generate_full_video(self, _script_path):
                    os.makedirs(self.config['output_dir'], exist_ok=True)
                    video_path = os.path.join(self.config['output_dir'], 'final.mp4')
                    with open(video_path, 'wb') as video_file:
                        video_file.write(b'\x00\x00\x00\x18ftypisommock-mp4')
                    return {'success': True, 'video_file': video_path}

            server.video_generator_class = Generator
            response = server.app.test_client().post(
                '/api/generate',
                headers={
                    'Authorization': 'Bearer ' + '-'.join(('valid', 'token')),
                },
                json={
                    'title': 'Test video',
                    'idea': 'This is a sufficiently long script.',
                },
            )

        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.get_json()['success'])
        self.assertEqual(response.get_json()['status'], 'failed')
        self.assertEqual(
            response.get_json()['error'],
            'Persistent video storage is unavailable.',
        )

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
