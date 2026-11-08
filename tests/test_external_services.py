import os
import base64
import io
import tempfile
import unittest
import wave
from unittest.mock import Mock, patch

from src.storage_service import StorageService
from src.tts_service import TTSService
from src.video_editor import VideoEditor
from src.google_flow_service import GoogleFlowService
from src.stable_diffusion_service import StableDiffusionService
from PIL import Image, ImageChops


class ExternalServiceTests(unittest.TestCase):
    def test_gtts_sentence_chunks_produce_audio_measured_caption_boundaries(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
                'tts_provider': 'gtts',
            })

            def synthesize(_text, output_path, _method):
                with open(output_path, 'wb') as audio:
                    audio.write(b'mp3')
                service._record_provider('gtts')
                return output_path

            with patch.object(service, '_generate_with_method', side_effect=synthesize) as synthesize_mock, \
                    patch.object(service, '_get_audio_duration', side_effect=[1.25, 2.5]), \
                    patch.object(service, 'concatenate_audio_files') as concatenate:
                def concatenate_audio(paths, output_path):
                    with open(output_path, 'wb') as audio:
                        audio.write(b'combined-mp3')
                    return output_path

                concatenate.side_effect = concatenate_audio
                audio_path, timings = service.generate_speech_with_timing(
                    '첫 문장입니다. 둘째 문장입니다.',
                    os.path.join(directory, 'narration.mp3'),
                    method='gtts',
                )
                self.assertTrue(os.path.isfile(audio_path))
                self.assertEqual(synthesize_mock.call_count, 2)
                self.assertEqual(timings[0]['start'], 0)
                self.assertEqual(timings[0]['end'], 1.25)
                self.assertEqual(timings[1]['start'], 1.25)
                self.assertEqual(timings[1]['end'], 3.75)
                self.assertEqual(service.last_provider, 'gtts')

    @patch.dict(os.environ, {}, clear=True)
    def test_tts_auto_defaults_to_gtts_without_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
            })

            self.assertEqual(service._configured_method('auto'), 'gtts')

    @patch('src.google_flow_service.requests.post')
    def test_google_image_api_uses_real_image_response_when_authorized(self, post):
        image_buffer = io.BytesIO()
        Image.new('RGB', (12, 20), (20, 40, 80)).save(image_buffer, format='PNG')
        response = Mock(status_code=200)
        response.json.return_value = {
            'output_image': {
                'data': base64.b64encode(image_buffer.getvalue()).decode('ascii'),
            },
        }
        post.return_value = response
        service = GoogleFlowService({'google_api_key': 'test-google-key'})

        with tempfile.TemporaryDirectory() as directory:
            output = os.path.join(directory, 'generated.png')
            self.assertTrue(service.generate_image_with_imagen('aircraft wing', output, 9, 16))
            self.assertEqual(service.last_generation_source, 'external')
            self.assertIsNone(service.last_error)
            with Image.open(output) as generated:
                self.assertEqual(generated.size, (12, 20))

        self.assertEqual(
            post.call_args.args[0],
            'https://generativelanguage.googleapis.com/v1beta/interactions',
        )
        self.assertEqual(post.call_args.kwargs['headers']['x-goog-api-key'], 'test-google-key')
        self.assertEqual(post.call_args.kwargs['json']['model'], 'gemini-nano-banana-2.1')
        self.assertNotIn('test-google-key', repr(post.call_args.kwargs['json']))

    @patch('src.google_flow_service.requests.post')
    def test_google_image_unauthorized_response_has_sanitized_error(self, post):
        post.return_value = Mock(status_code=401)
        service = GoogleFlowService({'google_api_key': 'private-google-key'})

        with tempfile.TemporaryDirectory() as directory:
            self.assertFalse(service.generate_image_with_imagen(
                'prompt',
                os.path.join(directory, 'image.png'),
            ))

        self.assertEqual(service.last_generation_source, 'fallback')
        self.assertEqual(service.last_error, 'image-provider-unauthorized')
        self.assertNotIn('private-google-key', repr(service.last_error))

    @patch('src.google_flow_service.requests.post')
    def test_google_image_invalid_api_key_disables_retries_without_exposing_error(self, post):
        response = Mock(status_code=400)
        response.json.return_value = [{
            'error': {
                'status': 'INVALID_ARGUMENT',
                'message': 'API key not valid. private-google-key',
            },
        }]
        post.return_value = response
        service = GoogleFlowService({'google_api_key': 'private-google-key'})

        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, 'image.png')
            self.assertFalse(service.generate_image_with_imagen('prompt', path))
            self.assertEqual(service.last_error, 'image-provider-unauthorized')
            self.assertFalse(service.generate_image_with_imagen('prompt', path))

        post.assert_called_once()
        self.assertNotIn('private-google-key', repr(service.last_error))

    @patch('src.google_flow_service.requests.post')
    def test_unavailable_google_provider_renders_a_real_local_diagram(self, post):
        post.return_value = Mock(status_code=401)
        service = GoogleFlowService({'google_api_key': 'private-google-key'})

        with tempfile.TemporaryDirectory() as directory:
            output = service.generate_base_image(
                'airplane wing lift and airflow',
                1,
                directory,
            )
            self.assertTrue(os.path.isfile(output))
            self.assertEqual(service.last_generation_source, 'local-renderer')
            with Image.open(output) as illustration:
                self.assertEqual(illustration.size, (1080, 1920))
                self.assertGreater(len(illustration.getcolors(1080 * 1920) or []), 20)

    def test_local_renderer_draws_bridge_load_path_from_fallback_prompt(self):
        service = GoogleFlowService({})
        with tempfile.TemporaryDirectory() as directory:
            output = os.path.join(directory, 'bridge.png')
            with patch.object(service, '_arrow', wraps=service._arrow) as arrow:
                service._create_local_illustration(
                    output,
                    360,
                    640,
                    'Visual subject: Bridge beams transfer traffic loads to piers and foundations.',
                    infographic=False,
                )
            self.assertGreaterEqual(arrow.call_count, 5)
            with Image.open(output) as illustration:
                self.assertEqual(illustration.size, (360, 640))

    def test_local_bridge_artwork_changes_with_each_scene_focus(self):
        service = GoogleFlowService({})
        scene_focuses = [
            'Traffic loads a deck while a truck crosses the bridge.',
            'Bridge beams bend under force across the span.',
            'A triangular truss shares compression and tension.',
            'Bridge piers transfer force into the soil foundation.',
        ]
        with tempfile.TemporaryDirectory() as directory:
            images = []
            for index, focus in enumerate(scene_focuses, start=1):
                output = os.path.join(directory, f'bridge-scene-{index}.png')
                service._create_local_illustration(
                    output,
                    360,
                    640,
                    'Visual subject: A bridge transfers traffic safely.\n'
                    f'Scene focus: {focus}',
                    infographic=False,
                )
                with Image.open(output) as illustration:
                    images.append(illustration.copy())

        for index, image in enumerate(images):
            for other in images[index + 1:]:
                difference = ImageChops.difference(image, other)
                self.assertIsNotNone(difference.getbbox())
                self.assertGreater(
                    sum(1 for pixel in difference.getdata() if pixel != (0, 0, 0)),
                    1000,
                )

    def test_generic_local_artwork_shows_a_connected_three_step_process(self):
        service = GoogleFlowService({})
        with tempfile.TemporaryDirectory() as directory:
            output = os.path.join(directory, 'process.png')
            with patch.object(service, '_arrow', wraps=service._arrow) as arrow:
                service._create_local_illustration(
                    output,
                    360,
                    640,
                    'Visual subject: A semiconductor controller routes a signal.\n'
                    'Scene focus: The sensor sends a signal through the controller to the motor.',
                    infographic=False,
                )
                self.assertEqual(arrow.call_count, 2)
                with Image.open(output) as illustration:
                    self.assertEqual(illustration.size, (360, 640))
                    self.assertGreater(len(illustration.getcolors(360 * 640) or []), 20)

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

    @patch('src.tts_service.requests.post')
    def test_elevenlabs_unauthorized_response_is_reported_when_falling_back(self, post):
        response = Mock(status_code=401, content=b'not exposed')
        response.headers = {'Content-Type': 'application/json'}
        post.return_value = response

        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
                'tts_api_key': 'test-token',
                'tts_voice': 'voice-id',
                'tts_provider': 'elevenlabs',
            })

            def create_fallback(_text, output_path, **_kwargs):
                with open(output_path, 'wb') as audio_file:
                    audio_file.write(b'fallback-audio')
                service._record_provider('gtts')
                return output_path

            service.generate_speech_with_gtts = create_fallback
            audio_path = service.generate_speech_from_script('테스트 음성')

            self.assertTrue(os.path.isfile(audio_path))
            self.assertTrue(service.used_fallback)
            self.assertEqual(service.last_provider, 'gtts')
            self.assertEqual(service.last_error, 'tts-unauthorized')
            self.assertNotIn('not exposed', repr(service.last_error))

    @patch('src.tts_service.GTTS_AVAILABLE', False)
    def test_synthetic_tts_fallback_is_marked_as_non_speech(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
                'tts_provider': 'gtts',
            })
            audio_path = service.generate_speech_from_script('테스트 음성')

            self.assertTrue(os.path.isfile(audio_path))
            self.assertEqual(service.last_provider, 'synthetic-fallback')
            self.assertIn('synthetic-fallback', service.providers_used)
            self.assertTrue(service.used_fallback)
            self.assertEqual(service.last_error, 'gtts-unavailable')

    @patch.dict(os.environ, {
        'TTS_API_KEY': 'process.env.ACTUAL_TTS_KEY',
        'ACTUAL_TTS_KEY': 'test-resolved-key',
        'TTS_PROVIDER': 'elevenlabs',
        'TTS_VOICE': 'test-voice',
    }, clear=False)
    @patch('src.tts_service.requests.post')
    def test_elevenlabs_resolves_environment_key_reference(self, post):
        response = Mock(status_code=200, content=b'ID3-audio')
        response.headers = {'Content-Type': 'audio/mpeg'}
        post.return_value = response

        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({'output_dir': directory, 'temp_dir': directory})
            audio_path = service.generate_speech_from_script('테스트 음성')

            self.assertTrue(os.path.isfile(audio_path))
            self.assertEqual(service.last_provider, 'elevenlabs')
            self.assertEqual(post.call_args.kwargs['headers']['xi-api-key'], 'test-resolved-key')

    def test_tts_does_not_return_success_for_a_missing_audio_file(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
                'tts_provider': 'gtts',
            })
            service._generate_with_method = lambda *_args: os.path.join(directory, 'missing.mp3')

            with self.assertRaisesRegex(RuntimeError, 'audio file'):
                service.generate_speech_from_script('test speech', method='gtts')

    def test_audio_duration_is_not_guessed_from_a_filename(self):
        with tempfile.TemporaryDirectory() as directory:
            service = TTSService({
                'output_dir': directory,
                'temp_dir': directory,
            })

            with self.assertRaisesRegex(RuntimeError, 'could not be measured'):
                service._get_audio_duration(os.path.join(directory, 'missing-audio.mp3'))

    @unittest.skipUnless(VideoEditor._find_ffmpeg(), 'FFmpeg is not installed')
    def test_tts_audio_duration_uses_ffmpeg_capable_probe(self):
        with tempfile.TemporaryDirectory() as directory:
            audio_path = os.path.join(directory, 'speech.wav')
            with wave.open(audio_path, 'wb') as audio_file:
                audio_file.setnchannels(1)
                audio_file.setsampwidth(2)
                audio_file.setframerate(22050)
                audio_file.writeframes(b'\0\0' * 2205)

            service = TTSService({'output_dir': directory, 'temp_dir': directory})

            self.assertGreater(service._get_audio_duration(audio_path), 0)

    @unittest.skipUnless(VideoEditor._find_ffmpeg(), 'FFmpeg is not installed')
    def test_audio_segments_concatenate_with_ffmpeg_when_pydub_cannot_decode(self):
        with tempfile.TemporaryDirectory() as directory:
            audio_paths = []
            for index in range(2):
                audio_path = os.path.join(directory, f'segment-{index}.wav')
                with wave.open(audio_path, 'wb') as audio_file:
                    audio_file.setnchannels(1)
                    audio_file.setsampwidth(2)
                    audio_file.setframerate(22050)
                    audio_file.writeframes(b'\0\0' * 2205)
                audio_paths.append(audio_path)

            service = TTSService({'output_dir': directory, 'temp_dir': directory})
            output_path = service.concatenate_audio_files(
                audio_paths,
                os.path.join(directory, 'combined.mp3'),
            )

            self.assertTrue(os.path.isfile(output_path))
            self.assertGreater(os.path.getsize(output_path), 0)
            self.assertGreater(service._get_audio_duration(output_path), 0)

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
