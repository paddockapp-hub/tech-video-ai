import os
import tempfile
import unittest
import wave

import numpy as np
import cv2
from PIL import Image

from src.video_editor import VideoEditor


@unittest.skipUnless(VideoEditor._find_ffmpeg(), "FFmpeg is not installed")
class FfmpegVideoPipelineTests(unittest.TestCase):
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
                }],
                audio_path,
            )

            self.assertTrue(os.path.isfile(output_path))
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
