import os
import base64
import io
import tempfile
import unittest
from unittest.mock import Mock, patch

from src.storage_service import StorageService
from src.tts_service import TTSService
from src.google_flow_service import GoogleFlowService
from src.stable_diffusion_service import StableDiffusionService
from PIL import Image


class ExternalServiceTests(unittest.TestCase):
    @patch('src.stable_diffusion_service.requests.post')
    def test_stable_diffusion_source_tracks_real_and_fallback_responses(self, post):
        image_buffer = io.BytesIO()
        Image.new('RGB', (8, 8), (10, 20, 30)).save(image_buffer, format='PNG')
        real_response = Mock(status_code=200)
        real_response.json.return_value = {
            'images': [base64.b64encode(image_buffer.getvalue()).decode('ascii')]
        }
        post.return_value = real_response
        service = StableDiffusionService()

        with tempfile.TemporaryDirectory() as directory:
            output = os.path.join(directory, 'image.png')
            self.assertTrue(service.generate_image('prompt', output, width=8, height=8))
            self.assertEqual(service.last_generation_source, 'external')

            invalid_response = Mock(status_code=200)
            invalid_response.json.return_value = {'images': ['not base64!']}
            post.return_value = invalid_response
            fallback_output = os.path.join(directory, 'fallback.png')
            self.assertTrue(service.generate_image('prompt', fallback_output, width=8, height=8))
            self.assertEqual(service.last_generation_source, 'fallback')
            with Image.open(fallback_output) as fallback_image:
                self.assertEqual(fallback_image.size, (8, 8))

    @patch('src.google_flow_service.genai.configure')
    def test_scene_source_requires_both_images_to_be_external(self, _configure):
        service = GoogleFlowService({})
        with tempfile.TemporaryDirectory() as directory:
            base = os.path.join(directory, 'base.png')
            infographic = os.path.join(directory, 'infographic.png')

            def generate_base(_prompt, _scene_number, _output_dir):
                with open(base, 'wb') as output:
                    output.write(b'base')
                service.last_generation_source = 'fallback'
                return base

            def generate_infographic(_prompt, _scene_number, _output_dir):
                with open(infographic, 'wb') as output:
                    output.write(b'infographic')
                service.last_generation_source = 'external'
                return infographic

            service.generate_base_image = generate_base
            service.generate_infographic_image = generate_infographic
            result = service.batch_generate_images(
                [{
                    'scene_number': 1,
                    'base_prompt': 'base prompt',
                    'infographic_prompt': 'diagram prompt',
                }],
                directory,
            )

        self.assertEqual(result[0]['source'], 'fallback')
        self.assertEqual(result[0]['base_image_source'], 'fallback')
        self.assertEqual(result[0]['infographic_image_source'], 'external')

    @patch('src.tts_service.requests.post')
    def test_elevenlabs_audio_requires_successful_audio_response(self, post):
        response = Mock(status_code=200, content=b'ID3-audio')
        response.headers = {'Content-Type': 'audio/mpeg'}
        post.return_value = response

        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
                'tts_api_key': 'test-token',
                'tts_voice': 'voice-id',
                'tts_provider': 'elevenlabs',
            })
            audio_path = service.generate_speech_from_script('테스트 음성')

            self.assertTrue(os.path.isfile(audio_path))
            self.assertEqual(service.last_provider, 'elevenlabs')
            self.assertEqual(service.providers_used, ['elevenlabs'])
            self.assertFalse(service.used_fallback)
            self.assertEqual(post.call_args.kwargs['headers']['xi-api-key'], 'test-token')

    def test_tts_does_not_return_success_for_a_missing_audio_file(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
                'tts_provider': 'gtts',
            })
            service._generate_with_method = lambda *_args: os.path.join(directory, 'missing.mp3')

            with self.assertRaisesRegex(RuntimeError, 'audio file'):
                service.generate_speech_from_script('test speech')

    def test_audio_duration_is_not_guessed_from_a_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
            })

            with self.assertRaisesRegex(RuntimeError, 'could not be measured'):
                service._get_audio_duration(os.path.join(directory, 'missing-audio.mp3'))

    @patch('src.storage_service.requests.put')
    def test_vercel_blob_success_uses_provider_response_without_returning_token(self, put):
        response = Mock(status_code=200)
        response.json.return_value = {
            'url': 'https://blob.example/video.mp4',
            'pathname': 'videos/video.mp4',
        }
        put.return_value = response
        token = 'test-blob-token'

        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, 'video.mp4')
            with open(source, 'wb') as output:
                output.write(b'video')
            service = StorageService({
                'storage_type': 'vercel',
                'local_storage_dir': directory,
                'blob_read_write_token': token,
            })
            result = service.upload_file(source, 'videos/video.mp4')

        self.assertTrue(result['success'])
        self.assertEqual(result['file_url'], 'https://blob.example/video.mp4')
        self.assertNotIn(token, repr(result))
        self.assertEqual(put.call_args.kwargs['headers']['Authorization'], f'Bearer {token}')

    @patch('src.storage_service.requests.put')
    def test_vercel_blob_http_failure_is_not_reported_as_success(self, put):
        put.return_value = Mock(status_code=500)
        token = 'test-blob-token'
        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, 'video.mp4')
            with open(source, 'wb') as output:
                output.write(b'video')
            service = StorageService({
                'storage_type': 'vercel',
                'local_storage_dir': directory,
                'blob_read_write_token': token,
            })
            result = service.upload_file(source, 'videos/video.mp4')

        self.assertFalse(result['success'])
        self.assertNotIn(token, repr(result))

    @patch('src.storage_service.S3_AVAILABLE', False)
    def test_unavailable_cloud_storage_fallback_is_explicit(self):
        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, 'video.mp4')
            with open(source, 'wb') as output:
                output.write(b'video')
            service = StorageService({
                'storage_type': 's3',
                'local_storage_dir': os.path.join(directory, 'uploads'),
            })
            result = service.upload_file(source, 'videos/video.mp4')

        self.assertTrue(result['success'])
        self.assertEqual(result['storage_type'], 'local')
        self.assertEqual(result['requested_storage_type'], 's3')
        self.assertTrue(result['fallback_used'])


if __name__ == '__main__':
    unittest.main()
