import os
import tempfile
import unittest
import wave

import numpy as np
import cv2
from PIL import Image, ImageDraw

from src.video_editor import VideoEditor
from src.keyframe_manager import KeyframeManager


@unittest.skipUnless(VideoEditor._find_ffmpeg(), "FFmpeg is not installed")
class FfmpegVideoPipelineTests(unittest.TestCase):
    def test_short_script_distributes_text_without_empty_scenes(self):
        manager = KeyframeManager({})
        result = manager.calculate_keyframes({
            'duration': 9,
            'script_text': 'Bridge beams carry the load into the foundations.',
        })

        segments = [keyframe['segment_text'] for keyframe in result['keyframes']]
        self.assertEqual(len(segments), 3)
        self.assertTrue(all(segments))
        self.assertEqual(' '.join(segments), 'Bridge beams carry the load into the foundations.')

    def test_subtitle_cues_wrap_text_and_cover_the_audio_duration(self):
        editor = VideoEditor({'image_width': 180, 'image_height': 320})
        font = editor._get_korean_font(18)
        cues = editor._build_subtitle_cues(
            '첫 번째 문장입니다. 두 번째 문장은 조금 더 길게 이어집니다!',
            6.0,
            font,
            120,
        )

        self.assertGreater(len(cues), 2)
        self.assertEqual(cues[0]['start'], 0)
        self.assertAlmostEqual(cues[-1]['end'], 6.0)
        self.assertTrue(all(cue['end'] > cue['start'] for cue in cues))
        self.assertTrue(all(len(cue['text'].splitlines()) <= 2 for cue in cues))

    def test_subtitle_cues_preserve_measured_tts_sentence_boundaries(self):
        editor = VideoEditor({'image_width': 180, 'image_height': 320})
        font = editor._get_korean_font(18)
        cues = editor._build_subtitle_cues(
            'First sentence. Second sentence.',
            4.0,
            font,
            150,
            timed_sentences=[
                {'text': 'First sentence.', 'start': 0.0, 'end': 1.4},
                {'text': 'Second sentence.', 'start': 1.4, 'end': 4.0},
            ],
        )

        self.assertEqual(cues[0]['start'], 0.0)
        self.assertEqual(cues[0]['end'], 1.4)
        self.assertEqual(cues[-1]['start'], 1.4)
        self.assertEqual(cues[-1]['end'], 4.0)

    def test_subtitle_line_wrapping_keeps_words_together_when_possible(self):
        editor = VideoEditor({'image_width': 180, 'image_height': 320})
        font = editor._get_korean_font(18)
        draw = ImageDraw.Draw(Image.new('RGB', (1, 1)))
        lines = editor._subtitle_lines(
            'Foundations carry it into the ground',
            font,
            130,
            draw,
        )

        self.assertIn('Foundations', lines)
        self.assertEqual(' '.join(lines), 'Foundations carry it into the ground')

    def test_missing_narration_creates_explicit_synthetic_audio_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            editor = VideoEditor({
                'output_dir': directory,
                'temp_dir': directory,
                'fps': 5,
                'image_width': 64,
                'image_height': 64,
            })
            output_path = editor.create_motion_graphics_video(
                [{'id': 1, 'duration': 0.4, 'description': 'Fallback scene'}],
                audio_path=None,
            )

            self.assertEqual(editor.last_audio_source, 'synthetic-fallback')
            self.assertTrue(os.path.isfile(output_path))
            editor._validate_video(output_path, require_audio=True)

    def test_ffmpeg_scene_render_extends_video_to_include_longer_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            base_image = os.path.join(directory, 'base.png')
            infographic_image = os.path.join(directory, 'infographic.png')
            audio_path = os.path.join(directory, 'speech.wav')
            Image.new('RGB', (64, 64), (20, 40, 60)).save(base_image)
            Image.new('RGBA', (64, 64), (200, 100, 20, 255)).save(infographic_image)

            sample_rate = 22050
            samples = (
                1000 * np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate)
            ).astype('<i2')
            with wave.open(audio_path, 'wb') as audio_file:
                audio_file.setnchannels(1)
                audio_file.setsampwidth(2)
                audio_file.setframerate(sample_rate)
                audio_file.writeframes(samples.tobytes())

            editor = VideoEditor({
                'output_dir': directory,
                'temp_dir': directory,
                'fps': 5,
                'image_width': 64,
                'image_height': 64,
            })
            output_path = os.path.join(directory, 'extended.mp4')
            editor._create_with_ffmpeg(
                [(base_image, infographic_image, 0.4)],
                audio_path,
                output_path,
                editor._find_ffmpeg(),
            )

            capture = cv2.VideoCapture(output_path)
            try:
                duration = (
                    capture.get(cv2.CAP_PROP_FRAME_COUNT)
                    / capture.get(cv2.CAP_PROP_FPS)
                )
            finally:
                capture.release()
            self.assertGreaterEqual(duration, 0.99)
            self.assertTrue(editor._has_audio_stream(output_path, editor._find_ffmpeg()))

    def test_ffmpeg_creates_and_validates_mp4_with_tts_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            base_image = os.path.join(directory, 'base.png')
            infographic_image = os.path.join(directory, 'infographic.png')
            audio_path = os.path.join(directory, 'speech.wav')
            Image.new('RGB', (64, 64), (20, 40, 60)).save(base_image)
            Image.new('RGBA', (64, 64), (200, 100, 20, 255)).save(infographic_image)

            sample_rate = 22050
            samples = (
                1000 * np.sin(2 * np.pi * 440 * np.arange(sample_rate) / sample_rate)
            ).astype('<i2')
            with wave.open(audio_path, 'wb') as audio_file:
                audio_file.setnchannels(1)
                audio_file.setsampwidth(2)
                audio_file.setframerate(sample_rate)
                audio_file.writeframes(samples.tobytes())

            editor = VideoEditor({
                'output_dir': directory,
                'temp_dir': directory,
                'fps': 5,
                'image_width': 64,
                'image_height': 64,
            })
            output_path = editor.create_motion_graphics_video(
                [{
                    'id': 1,
                    'base_image_path': base_image,
                    'infographic_image_path': infographic_image,
                    'duration': 0.8,
                    'segment_text': 'Bridge beams carry the load.',
                }],
                audio_path,
            )

            self.assertTrue(os.path.isfile(output_path))
            self.assertEqual(
                editor.last_visual_source,
                'scene-artwork-with-parallax',
            )
            self.assertTrue(editor.last_subtitle_cues)
            self.assertIn(
                'Bridge',
                ''.join(cue['text'].replace('\n', '') for cue in editor.last_subtitle_cues),
            )
            self.assertGreater(os.path.getsize(output_path), 0)
            editor._validate_video(output_path, require_audio=True)
            capture = cv2.VideoCapture(output_path)
            try:
                duration = (
                    capture.get(cv2.CAP_PROP_FRAME_COUNT)
                    / capture.get(cv2.CAP_PROP_FPS)
                )
            finally:
                capture.release()
            self.assertGreaterEqual(duration, 0.99)

            optimized_path = editor.optimize_video_for_platform(output_path, 'youtube')
            self.assertTrue(os.path.isfile(optimized_path))
            editor._validate_video(optimized_path, require_audio=True)


if __name__ == '__main__':
    unittest.main()
