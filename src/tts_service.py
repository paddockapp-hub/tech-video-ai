"""
TTS Service Module
Microsoft Edge TTS (40대 신뢰도 있는 남성 목소리: ko-KR-InJoonNeural) 및 gTTS/Google TTS 폴백 통합
"""

import os
import sys
import asyncio
import subprocess
import wave
import shutil
import tempfile
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
import requests
import re
from urllib.parse import quote

# Optional third-party imports
try:
    import edge_tts
    EDGE_TTS_AVAILABLE = True
except ImportError:
    EDGE_TTS_AVAILABLE = False

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

try:
    from google.cloud import texttospeech
    GOOGLE_TTS_AVAILABLE = True
except ImportError:
    GOOGLE_TTS_AVAILABLE = False

try:
    from .env_utils import get_env_value, resolve_env_value
except ImportError:
    try:
        from env_utils import get_env_value, resolve_env_value
    except ImportError:
        def get_env_value(key, default=None):
            return os.getenv(key, default)
        def resolve_env_value(val):
            return val


# 40대 신뢰감 있는 남성 목소리 고정 상수 (Microsoft InJoon)
DEFAULT_TRUSTED_MALE_VOICE = "ko-KR-InJoonNeural"


class TTSService:
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.output_dir = self.config.get('output_dir', 'output')
        self.temp_dir = self.config.get('temp_dir', 'temp')
        self.last_provider = None
        self.last_error = None
        self.providers_used = []
        self.used_fallback = False
        self.last_voice = DEFAULT_TRUSTED_MALE_VOICE

        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)

        self.google_tts_client = None
        if self.config.get('google_tts_enabled', False) and GOOGLE_TTS_AVAILABLE:
            try:
                self.google_tts_client = texttospeech.TextToSpeechClient()
            except Exception:
                pass

        self.gtts_available = GTTS_AVAILABLE
        self.edge_tts_available = EDGE_TTS_AVAILABLE

    def _language_code(self) -> str:
        return (
            resolve_env_value(self.config.get('tts_language'))
            or get_env_value('TTS_LANGUAGE')
            or 'ko-KR'
        )

    def _api_key(self) -> Optional[str]:
        for name in ('TTS_API_KEY', 'TTS_API_KEY_2', 'TTS_API_KEY_3', 'apiKey'):
            value = resolve_env_value(self.config.get('tts_api_key')) if name == 'TTS_API_KEY' else None
            value = value or get_env_value(name)
            if value and value.strip():
                return value.strip()
        return None

    def _elevenlabs_voice_id(self) -> Optional[str]:
        voice = (
            resolve_env_value(self.config.get('tts_voice'))
            or get_env_value('TTS_VOICE')
        )
        return voice.strip() if voice and voice.strip() else None

    def _voice_id(self) -> str:
        # 사용자의 요구사항: 신뢰도 있는 40대 남성 목소리로 고정
        voice = (
            resolve_env_value(self.config.get('tts_voice'))
            or get_env_value('TTS_VOICE')
            or DEFAULT_TRUSTED_MALE_VOICE
        )
        return voice

    def _record_provider(self, provider: str) -> None:
        self.last_provider = provider
        if provider not in self.providers_used:
            self.providers_used.append(provider)

    @staticmethod
    def _validate_audio_file(audio_path: str) -> str:
        if not isinstance(audio_path, str) or not os.path.isfile(audio_path):
            raise RuntimeError("Speech provider did not create an audio file.")
        if os.path.getsize(audio_path) == 0:
            raise RuntimeError("Speech provider created an empty audio file.")
        return audio_path

    def generate_speech_with_elevenlabs(
        self,
        text: str,
        output_path: str = None,
    ) -> str:
        api_key = self._api_key()
        voice_id = self._elevenlabs_voice_id()
        if not api_key or not voice_id:
            raise RuntimeError('tts-not-configured')
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'elevenlabs_speech.mp3')
        parent_dir = os.path.dirname(output_path) or '.'
        os.makedirs(parent_dir, exist_ok=True)

        try:
            response = requests.post(
                f'https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id, safe="")}',
                headers={
                    'xi-api-key': api_key,
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                },
                json={
                    'text': text,
                    'model_id': 'eleven_multilingual_v2',
                },
                timeout=60,
            )
        except requests.RequestException:
            raise RuntimeError('tts-unreachable') from None

        if response.status_code == 401 or response.status_code == 403:
            raise RuntimeError('tts-unauthorized')
        if response.status_code == 429:
            raise RuntimeError('tts-rate-limited')
        if response.status_code != 200:
            raise RuntimeError('tts-provider-error')

        content_type = response.headers.get('Content-Type', '').lower()
        audio_data = response.content
        if not audio_data or not content_type.startswith('audio/'):
            raise RuntimeError('tts-invalid-audio')

        with open(output_path, 'wb') as audio_file:
            audio_file.write(audio_data)
        self._validate_audio_file(output_path)
        self.last_voice = voice_id
        self.last_error = None
        self._record_provider('elevenlabs')
        return output_path

    @staticmethod
    def _ffmpeg_path() -> str:
        ffmpeg = shutil.which('ffmpeg')
        if ffmpeg:
            return ffmpeg
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except (ImportError, RuntimeError):
            return ''

    def _get_audio_duration(self, audio_path: str) -> float:
        if not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
            raise RuntimeError('Audio file is missing or empty; duration could not be measured.')
        ffmpeg = self._ffmpeg_path()
        if not ffmpeg:
            raise RuntimeError('Audio duration could not be measured: FFmpeg is unavailable.')

        try:
            result = subprocess.run(
                [
                    ffmpeg, '-hide_banner', '-i', audio_path,
                    '-map', '0:a:0', '-f', 'null', '-',
                ],
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            raise RuntimeError('Audio duration could not be measured.') from None
        match = re.search(
            r'Duration:\s*(\d+):(\d+):([\d.]+)',
            result.stderr or '',
        )
        if result.returncode != 0 or not match:
            raise RuntimeError('Audio duration could not be measured.')
        duration = (
            int(match.group(1)) * 3600
            + int(match.group(2)) * 60
            + float(match.group(3))
        )
        if duration <= 0:
            raise RuntimeError('Audio duration could not be measured.')
        return duration

    def concatenate_audio_files(
        self,
        audio_files: List[str],
        output_path: str = None,
    ) -> str:
        if not audio_files:
            raise ValueError('At least one audio file is required.')
        for audio_path in audio_files:
            self._validate_audio_file(audio_path)
        ffmpeg = self._ffmpeg_path()
        if not ffmpeg:
            raise RuntimeError('FFmpeg is unavailable for audio concatenation.')
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'combined_speech.mp3')
        parent_dir = os.path.dirname(output_path) or '.'
        os.makedirs(parent_dir, exist_ok=True)

        manifest_path = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w',
                encoding='utf-8',
                suffix='.txt',
                dir=parent_dir,
                delete=False,
            ) as manifest:
                manifest_path = manifest.name
                for audio_path in audio_files:
                    safe_path = os.path.abspath(audio_path).replace('\\', '/')
                    escaped_path = safe_path.replace("'", "'\\''")
                    manifest.write(f"file '{escaped_path}'\n")
            result = subprocess.run(
                [
                    ffmpeg, '-y', '-hide_banner', '-f', 'concat', '-safe', '0',
                    '-i', manifest_path, '-vn', '-c:a', 'libmp3lame', '-q:a', '4',
                    output_path,
                ],
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
            if result.returncode != 0:
                raise RuntimeError('FFmpeg could not concatenate the audio files.')
            self._validate_audio_file(output_path)
            self._get_audio_duration(output_path)
            return output_path
        except (OSError, subprocess.TimeoutExpired):
            raise RuntimeError('FFmpeg could not concatenate the audio files.') from None
        finally:
            if manifest_path and os.path.exists(manifest_path):
                os.remove(manifest_path)

    def _generate_with_method(self, text: str, output_path: str, method: str) -> str:
        if method == 'elevenlabs':
            result = self.generate_speech_with_elevenlabs(text, output_path)
        elif method in ('google', 'google_tts'):
            result = self.generate_speech_with_google_tts(text, output_path)
        elif method == 'gtts':
            result = self.generate_speech_with_gtts(text, output_path)
        elif method in ('edge', 'edge-tts', 'edge_tts'):
            result = self.generate_speech_with_edge_tts(text, output_path)
        else:
            raise RuntimeError('Unsupported TTS provider.')
        audio_path = result[0] if isinstance(result, tuple) else result
        return self._validate_audio_file(audio_path)

    def generate_speech_with_google_tts(
        self,
        text: str,
        output_path: str = None,
        voice_name: str = 'ko-KR-Wavenet-A',
    ) -> str:
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'google_speech.mp3')
        if not self.google_tts_client:
            self.used_fallback = True
            self.last_error = 'google-tts-not-configured'
            return self.generate_speech_with_gtts(
                text,
                output_path,
                language=self._language_code().split('-')[0],
            )

        try:
            synthesis_input = texttospeech.SynthesisInput(text=text)
            voice = texttospeech.VoiceSelectionParams(
                language_code=self._language_code(),
                name=voice_name,
            )
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3,
            )
            response = self.google_tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config,
            )
            if not response.audio_content:
                raise RuntimeError('tts-invalid-audio')
            os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
            with open(output_path, 'wb') as audio_file:
                audio_file.write(response.audio_content)
            self._validate_audio_file(output_path)
            self._record_provider('google')
            self.last_error = None
            return output_path
        except Exception:
            self.last_error = 'google-tts-error'
            self.used_fallback = True
            return self.generate_speech_with_gtts(
                text,
                output_path,
                language=self._language_code().split('-')[0],
            )

    def _configured_method(self, method: str) -> str:
        if method != 'auto':
            return method
        provider = (
            resolve_env_value(self.config.get('tts_provider'))
            or get_env_value('TTS_PROVIDER')
        )
        if provider:
            return provider.strip().lower()
        if self._api_key() and self._elevenlabs_voice_id():
            return 'elevenlabs'
        return 'gtts'

    def generate_segmented_speech(
        self,
        segments: List[str],
        output_dir: str = None,
    ) -> List[Dict[str, Any]]:
        if output_dir is None:
            output_dir = os.path.join(self.output_dir, 'speech_segments')
        os.makedirs(output_dir, exist_ok=True)
        generated = []
        for index, segment in enumerate(segments):
            output_path = os.path.join(output_dir, f'segment_{index + 1:02d}.mp3')
            audio_path = self.generate_speech_from_script(segment, output_path)
            generated.append({
                'segment_index': index,
                'text': segment,
                'audio_path': audio_path,
                'duration': self._get_audio_duration(audio_path),
            })
        return generated

    @staticmethod
    def _split_long_text(text: str, max_length: int) -> List[str]:
        if max_length <= 0:
            raise ValueError('max_length must be greater than zero.')
        sentences = re.split(r'(?<=[.!?。！？])\s*', text.strip())
        segments = []
        current = ''
        for sentence in filter(None, sentences):
            while len(sentence) > max_length:
                if current:
                    segments.append(current)
                    current = ''
                split_at = sentence.rfind(' ', 0, max_length + 1)
                if split_at <= 0:
                    split_at = max_length
                segments.append(sentence[:split_at].strip())
                sentence = sentence[split_at:].strip()
            candidate = f'{current} {sentence}'.strip()
            if len(candidate) > max_length and current:
                segments.append(current)
                current = sentence
            else:
                current = candidate
        if current:
            segments.append(current)
        return segments

    @staticmethod
    def _split_into_timed_sentences(text: str, max_length: int) -> List[str]:
        if max_length <= 0:
            raise ValueError('max_length must be greater than zero.')
        sentences = re.split(r'(?<=[.!?。！？])\s+', text.strip())
        segments = []
        for sentence in filter(None, sentences):
            while len(sentence) > max_length:
                split_at = sentence.rfind(' ', 0, max_length + 1)
                if split_at <= 0:
                    split_at = max_length
                segments.append(sentence[:split_at].strip())
                sentence = sentence[split_at:].strip()
            if sentence:
                segments.append(sentence)
        return segments

    def adjust_audio_speed(
        self,
        audio_path: str,
        speed_factor: float = 1.0,
        output_path: str = None,
    ) -> str:
        self._validate_audio_file(audio_path)
        if not 0.5 <= speed_factor <= 2.0:
            raise ValueError('speed_factor must be between 0.5 and 2.0.')
        if output_path is None:
            base, extension = os.path.splitext(audio_path)
            output_path = f'{base}_adjusted{extension or ".mp3"}'
        ffmpeg = self._ffmpeg_path()
        if not ffmpeg:
            raise RuntimeError('FFmpeg is unavailable for audio speed adjustment.')
        result = subprocess.run(
            [
                ffmpeg, '-y', '-hide_banner', '-i', audio_path,
                '-filter:a', f'atempo={speed_factor}', '-vn',
                output_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError('FFmpeg could not adjust audio speed.')
        self._validate_audio_file(output_path)
        self._get_audio_duration(output_path)
        return output_path

    def add_background_music(
        self,
        speech_path: str,
        music_path: str,
        output_path: str = None,
        music_volume: float = 0.3,
    ) -> str:
        self._validate_audio_file(speech_path)
        self._validate_audio_file(music_path)
        if not 0.0 <= music_volume <= 1.0:
            raise ValueError('music_volume must be between 0 and 1.')
        if output_path is None:
            base, extension = os.path.splitext(speech_path)
            output_path = f'{base}_with_music{extension or ".mp3"}'
        ffmpeg = self._ffmpeg_path()
        if not ffmpeg:
            raise RuntimeError('FFmpeg is unavailable for audio mixing.')
        result = subprocess.run(
            [
                ffmpeg, '-y', '-hide_banner', '-stream_loop', '-1', '-i', music_path,
                '-i', speech_path, '-filter_complex',
                f'[0:a]volume={music_volume}[music];[1:a][music]amix=inputs=2:duration=first:dropout_transition=2[a]',
                '-map', '[a]', '-c:a', 'libmp3lame', '-q:a', '4', output_path,
            ],
            capture_output=True,
            text=True,
            timeout=300,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError('FFmpeg could not mix background music.')
        self._validate_audio_file(output_path)
        self._get_audio_duration(output_path)
        return output_path

    @staticmethod
    def preview_audio(audio_path: str) -> None:
        TTSService._validate_audio_file(audio_path)
        print('Audio preview is not available in this runtime; use the generated file.')

    def generate_speech_with_edge_tts(
        self,
        text: str,
        output_path: str = None,
        voice_name: str = None
    ) -> Tuple[str, List[Dict]]:
        """Edge-TTS를 사용하여 40대 신뢰도 있는 남성 목소리(InJoon)로 고품질 음성 및 문장 타이밍 생성"""
        if not self.edge_tts_available:
            raise RuntimeError("edge_tts package is not available.")

        if output_path is None:
            output_path = os.path.join(self.output_dir, 'speech_injoon.mp3')
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        voice = voice_name or self._voice_id() or DEFAULT_TRUSTED_MALE_VOICE
        self.last_voice = voice

        async def _synthesize():
            sentences = []
            communicate = edge_tts.Communicate(text, voice)
            with open(output_path, 'wb') as audio_file:
                async for chunk in communicate.stream():
                    if chunk['type'] == 'audio':
                        audio_file.write(chunk['data'])
                    elif chunk['type'] == 'SentenceBoundary':
                        start = chunk['offset'] / 1e7
                        dur = chunk['duration'] / 1e7
                        sentences.append({
                            'text': chunk['text'],
                            'start': round(start, 3),
                            'duration': round(dur, 3),
                            'end': round(start + dur, 3)
                        })
            return sentences

        try:
            sentences = asyncio.run(_synthesize())
            self._validate_audio_file(output_path)
            self._record_provider('edge-tts')
            self.last_error = None
            print(f"[TTS] Edge-TTS 40대 남성({voice}) 음성 생성 완료: {output_path}")
            return output_path, sentences
        except Exception:
            print("[TTS] Edge-TTS generation failed; using the configured fallback.")
            self.last_error = "edge-tts-error"
            self.used_fallback = True
            fallback_path = self.generate_speech_with_gtts(text, output_path)
            return fallback_path, []

    def generate_speech_with_gtts(
        self,
        text: str,
        output_path: str = None,
        language: str = 'ko',
        slow: bool = False
    ) -> str:
        """gTTS 폴백 음성 생성"""
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'speech_gtts.mp3')
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        if self.gtts_available:
            try:
                tts = gTTS(text=text, lang=language, slow=slow)
                tts.save(output_path)
                self._validate_audio_file(output_path)
                self._record_provider('gtts')
                return output_path
            except Exception:
                print("[TTS] gTTS generation failed.")
                self.used_fallback = True
                self.last_error = self.last_error or 'gtts-unavailable'
        else:
            self.used_fallback = True
            self.last_error = self.last_error or 'gtts-unavailable'

        # 로컬 합성 오프라인 합성 (WAV) 비상 폴백
        return self._generate_synthetic_tone_wav(output_path, duration_sec=max(3.0, len(text) * 0.15))

    def _generate_synthetic_tone_wav(self, output_path: str, duration_sec: float = 3.0) -> str:
        """네트워크 완전 두절 시에도 영상 파이프라인이 멈추지 않도록 무음/톤 wav 생성"""
        if output_path.endswith('.mp3'):
            output_path = output_path[:-4] + '.wav'
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        sample_rate = 24000
        total_samples = int(sample_rate * duration_sec)
        t = np.linspace(0, duration_sec, total_samples, endpoint=False)
        waveform = (300 * np.sin(2 * np.pi * 200 * t)).astype(np.int16)

        with wave.open(output_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(waveform.tobytes())

        self.used_fallback = True
        self.last_error = self.last_error or 'tts-unavailable'
        self._record_provider('synthetic-fallback')
        return output_path

    def generate_speech_from_script(
        self,
        script_text: str,
        output_path: str = None,
        method: str = 'auto',
    ) -> str:
        """메인 엔드포인트: 40대 신뢰도 있는 남성 목소리(ko-KR-InJoonNeural)로 자동 생성"""
        output_path, _ = self.generate_speech_with_timing(script_text, output_path, method)
        return output_path

    def _generate_gtts_with_sentence_timing(
        self,
        text: str,
        output_path: str,
    ) -> Tuple[str, List[Dict[str, Any]]]:
        sentences = self._split_into_timed_sentences(text, 180)
        if len(sentences) < 2:
            audio_path = self._generate_with_method(text, output_path, 'gtts')
            if self.last_provider != 'gtts':
                return audio_path, []
            duration = self._get_audio_duration(audio_path)
            return audio_path, [{
                'text': text.strip(),
                'start': 0.0,
                'end': round(duration, 3),
                'duration': round(duration, 3),
            }]

        segment_dir = tempfile.mkdtemp(prefix='tts-sentences-', dir=self.temp_dir)
        segment_paths = []
        timings = []
        elapsed = 0.0
        try:
            for index, sentence in enumerate(sentences):
                segment_path = os.path.join(segment_dir, f'sentence_{index + 1:03d}.mp3')
                generated_path = self._generate_with_method(
                    sentence,
                    segment_path,
                    'gtts',
                )
                if self.last_provider != 'gtts':
                    fallback_path = (
                        f'{os.path.splitext(output_path)[0]}.wav'
                        if generated_path.lower().endswith('.wav')
                        else output_path
                    )
                    shutil.copy2(generated_path, fallback_path)
                    return fallback_path, []
                duration = self._get_audio_duration(generated_path)
                segment_paths.append(generated_path)
                timings.append({
                    'text': sentence,
                    'start': round(elapsed, 3),
                    'end': round(elapsed + duration, 3),
                    'duration': round(duration, 3),
                })
                elapsed += duration

            self.concatenate_audio_files(segment_paths, output_path)
            self._record_provider('gtts')
            self.last_error = None
            return output_path, timings
        finally:
            shutil.rmtree(segment_dir, ignore_errors=True)

    def generate_speech_with_timing(
        self,
        text: str,
        output_path: str = None,
        method: str = 'auto',
    ) -> Tuple[str, List[Dict]]:
        """음성 파일과 문장 타이밍을 동시에 생성 및 반환"""
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'final_narration.mp3')

        self.last_error = None
        self.used_fallback = False
        configured_provider = self._configured_method(method).lower()
        if configured_provider in ('auto', 'default') and self._api_key() and self._elevenlabs_voice_id():
            configured_provider = 'elevenlabs'
        elif configured_provider in ('auto', 'default'):
            configured_provider = 'gtts'

        if configured_provider in ('elevenlabs', 'eleven-labs'):
            try:
                audio_path = self._generate_with_method(text, output_path, 'elevenlabs')
                return self._validate_audio_file(audio_path), []
            except RuntimeError as error:
                self.last_error = str(error) if str(error).startswith('tts-') else 'tts-provider-error'
                self.used_fallback = True
                try:
                    audio_path = self._generate_with_method(text, output_path, 'gtts')
                    return self._validate_audio_file(audio_path), []
                except Exception:
                    self.last_error = self.last_error or 'tts-provider-error'
                    return self._generate_synthetic_tone_wav(
                        output_path,
                        duration_sec=max(3.0, len(text) * 0.15),
                    ), []

        if configured_provider in ('google', 'google_tts', 'google-cloud-tts'):
            try:
                audio_path = self._generate_with_method(text, output_path, 'google_tts')
                return self._validate_audio_file(audio_path), []
            except Exception:
                self.used_fallback = True
                self.last_error = self.last_error or 'google-tts-error'
                try:
                    audio_path = self._generate_with_method(text, output_path, 'gtts')
                    return self._validate_audio_file(audio_path), []
                except Exception:
                    return self._generate_synthetic_tone_wav(
                        output_path,
                        duration_sec=max(3.0, len(text) * 0.15),
                    ), []

        if configured_provider == 'gtts':
            try:
                audio_path, sentences = self._generate_gtts_with_sentence_timing(
                    text,
                    output_path,
                )
                if sentences:
                    return self._validate_audio_file(audio_path), sentences
                if self.last_provider == 'synthetic-fallback':
                    return self._validate_audio_file(audio_path), []
                return self._validate_audio_file(audio_path), []
            except RuntimeError as error:
                if str(error).startswith('Speech provider did not create') or str(error).startswith('Speech provider created'):
                    raise
                self.used_fallback = True
                self.last_error = 'tts-provider-error'
                return self._generate_synthetic_tone_wav(
                    output_path,
                    duration_sec=max(3.0, len(text) * 0.15),
                ), []
            except Exception:
                self.used_fallback = True
                self.last_error = 'tts-provider-error'
                return self._generate_synthetic_tone_wav(
                    output_path,
                    duration_sec=max(3.0, len(text) * 0.15),
                ), []

        if configured_provider in ('edge', 'edge-tts', 'edge_tts'):
            try:
                return self.generate_speech_with_edge_tts(text, output_path)
            except Exception:
                self.used_fallback = True
                self.last_error = 'edge-tts-error'
                try:
                    return self._generate_with_method(text, output_path, 'gtts'), []
                except Exception:
                    return self._generate_synthetic_tone_wav(
                        output_path,
                        duration_sec=max(3.0, len(text) * 0.15),
                    ), []

        self.last_error = 'tts-provider-not-supported'
        self.used_fallback = True
        try:
            return self._generate_with_method(text, output_path, 'gtts'), []
        except Exception:
            return self._generate_synthetic_tone_wav(
                output_path,
                duration_sec=max(3.0, len(text) * 0.15),
            ), []
