"""
TTS Service Module
텍스트 음성 변환 서비스 - Google TTS 및 gTTS 통합
"""

import os
from typing import Dict, List, Any
import requests
import tempfile

# 의존성 import
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


class TTSService:
    def __init__(self, config: Dict):
        self.config = config
        self.output_dir = config.get('output_dir', 'output')
        self.temp_dir = config.get('temp_dir', 'temp')
        
        # 디렉토리 생성
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # Google Cloud TTS 클라이언트 설정 (API 키가 있는 경우)
        self.google_tts_client = None
        if config.get('google_tts_enabled', False) and GOOGLE_TTS_AVAILABLE:
            try:
                self.google_tts_client = texttospeech.TextToSpeechClient()
            except Exception as e:
                print(f"Google Cloud TTS 초기화 실패: {e}")
                print("gTTS를 사용하여 대체합니다.")
        
        # gTTS 가용성 확인
        self.gtts_available = GTTS_AVAILABLE
        if not self.gtts_available:
            print("gTTS를 사용할 수 없습니다. 음성 생성 기능이 제한됩니다.")
    
    def generate_speech_with_gtts(self, text: str, output_path: str = None, 
                                language: str = 'ko', slow: bool = False) -> str:
        """gTTS를 사용하여 음성 생성"""
        
        if not self.gtts_available:
            raise RuntimeError("gTTS를 사용할 수 없습니다.")
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'speech_gtts.mp3')
        
        try:
            from gtts import gTTS
            # gTTS로 음성 생성
            tts = gTTS(text=text, lang=language, slow=slow)
            tts.save(output_path)
            
            print(f"gTTS 음성 생성 완료: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"gTTS 음성 생성 중 오류 발생: {e}")
            raise RuntimeError(f"gTTS 음성 생성 실패: {str(e)}")
    
    def generate_speech_with_google_tts(self, text: str, output_path: str = None,
                                      voice_name: str = 'ko-KR-Wavenet-A') -> str:
        """Google Cloud TTS를 사용하여 음성 생성"""
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'speech_google.mp3')
        
        if not self.google_tts_client:
            print("Google Cloud TTS 클라이언트가 초기화되지 않았습니다. gTTS를 사용합니다.")
            return self.generate_speech_with_gtts(text, output_path)
        
        try:
            # TTS 요청 설정
            synthesis_input = texttospeech.SynthesisInput(text=text)
            
            # 음성 설정
            voice = texttospeech.VoiceSelectionParams(
                language_code='ko-KR',
                name=voice_name
            )
            
            # 오디오 설정
            audio_config = texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3
            )
            
            # 음성 생성 요청
            response = self.google_tts_client.synthesize_speech(
                input=synthesis_input,
                voice=voice,
                audio_config=audio_config
            )
            
            # 오디오 파일 저장
            with open(output_path, 'wb') as out:
                out.write(response.audio_content)
            
            print(f"Google TTS 음성 생성 완료: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"Google TTS 음성 생성 중 오류 발생: {e}")
            print("gTTS를 사용하여 대체 생성합니다.")
            return self.generate_speech_with_gtts(text, output_path)
    
    def generate_segmented_speech(self, segments: List[str], output_dir: str = None) -> List[str]:
        """세그먼트별 음성 생성"""
        
        if output_dir is None:
            output_dir = os.path.join(self.output_dir, 'speech_segments')
        
        os.makedirs(output_dir, exist_ok=True)
        
        audio_files = []
        
        for i, segment in enumerate(segments):
            output_path = os.path.join(output_dir, f'segment_{i+1:02d}.mp3')
            
            try:
                # Google TTS 시도
                audio_path = self.generate_speech_with_google_tts(segment, output_path)
            except Exception as e:
                print(f"세그먼트 {i+1} Google TTS 실패: {e}")
                # gTTS 대체
                audio_path = self.generate_speech_with_gtts(segment, output_path)
            
            audio_files.append({
                'segment_index': i,
                'text': segment,
                'audio_path': audio_path,
                'duration': self._get_audio_duration(audio_path)
            })
        
        return audio_files
    
    def _get_audio_duration(self, audio_path: str) -> float:
        """오디오 파일 길이 가져오기"""
        
        try:
            from pydub import AudioSegment
            audio = AudioSegment.from_mp3(audio_path)
            return len(audio) / 1000.0  # 밀리초를 초로 변환
        except Exception as e:
            print(f"오디오 길이 측정 중 오류: {e}")
            # 텍스트 길이로 추정 (한국어 기준)
            return len(audio_path) / 5.0  # 대략적인 추정
    
    def concatenate_audio_files(self, audio_files: List[str], output_path: str = None) -> str:
        """여러 오디오 파일 연결"""
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'concatenated_speech.mp3')
        
        try:
            from pydub import AudioSegment
            
            combined = AudioSegment.empty()
            
            for audio_file in audio_files:
                if os.path.exists(audio_file):
                    audio = AudioSegment.from_mp3(audio_file)
                    combined += audio
            
            combined.export(output_path, format='mp3')
            
            print(f"오디오 연결 완료: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"오디오 연결 중 오류 발생: {e}")
            raise
    
    def generate_speech_from_script(self, script_text: str, output_path: str = None,
                                   method: str = 'auto') -> str:
        """스크립트 전체 음성 생성"""
        
        if not self.gtts_available:
            raise RuntimeError("음성 생성 서비스를 사용할 수 없습니다.")
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'full_speech.mp3')
        
        # 긴 텍스트인 경우 세그먼트로 분할
        if len(script_text) > 500:  # 500자 이상이면 분할
            segments = self._split_long_text(script_text, 500)
            audio_files = []
            
            for segment in segments:
                temp_path = os.path.join(self.temp_dir, 'temp_segment.mp3')
                try:
                    if method == 'google':
                        audio_path = self.generate_speech_with_google_tts(segment, temp_path)
                    else:
                        audio_path = self.generate_speech_with_gtts(segment, temp_path)
                    audio_files.append(audio_path)
                except Exception as e:
                    print(f"세그먼트 음성 생성 실패: {e}")
                    continue
            
            if not audio_files:
                raise RuntimeError("모든 세그먼트 음성 생성 실패")
            
            # 오디오 연결
            try:
                final_path = self.concatenate_audio_files(audio_files, output_path)
            except Exception as e:
                raise RuntimeError(f"오디오 연결 실패: {str(e)}")
            
            # 임시 파일 삭제
            for temp_file in audio_files:
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except Exception as e:
                        print(f"임시 파일 삭제 실패: {e}")
            
            return final_path
        else:
            # 짧은 텍스트는 바로 생성
            try:
                if method == 'google':
                    return self.generate_speech_with_google_tts(script_text, output_path)
                else:
                    return self.generate_speech_with_gtts(script_text, output_path)
            except Exception as e:
                raise RuntimeError(f"음성 생성 실패: {str(e)}")
    
    def _split_long_text(self, text: str, max_length: int) -> List[str]:
        """긴 텍스트를 적절한 길이로 분할"""
        
        # 문장 단위로 분할
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        
        segments = []
        current_segment = ""
        
        for sentence in sentences:
            if len(current_segment + sentence) <= max_length:
                current_segment += sentence + " "
            else:
                if current_segment:
                    segments.append(current_segment.strip())
                current_segment = sentence + " "
        
        if current_segment:
            segments.append(current_segment.strip())
        
        return segments
    
    def adjust_audio_speed(self, audio_path: str, speed_factor: float = 1.0, 
                          output_path: str = None) -> str:
        """오디오 속도 조절"""
        
        if output_path is None:
            base, ext = os.path.splitext(audio_path)
            output_path = f"{base}_adjusted{ext}"
        
        try:
            from pydub import AudioSegment
            
            audio = AudioSegment.from_mp3(audio_path)
            
            if speed_factor > 1.0:
                # 빠르게
                new_audio = audio._spawn(audio.raw_data, overrides={
                    "frame_rate": int(audio.frame_rate * speed_factor)
                })
                new_audio = new_audio.set_frame_rate(audio.frame_rate)
            else:
                # 느리게
                new_audio = audio._spawn(audio.raw_data, overrides={
                    "frame_rate": int(audio.frame_rate * speed_factor)
                })
                new_audio = new_audio.set_frame_rate(audio.frame_rate)
            
            new_audio.export(output_path, format='mp3')
            
            print(f"오디오 속도 조절 완료: {output_path} (배율: {speed_factor})")
            return output_path
            
        except Exception as e:
            print(f"오디오 속도 조절 중 오류: {e}")
            return audio_path
    
    def add_background_music(self, speech_path: str, music_path: str, 
                           output_path: str = None, music_volume: float = 0.3) -> str:
        """배경음악 추가"""
        
        if output_path is None:
            base, ext = os.path.splitext(speech_path)
            output_path = f"{base}_with_music{ext}"
        
        try:
            from pydub import AudioSegment
            
            speech = AudioSegment.from_mp3(speech_path)
            music = AudioSegment.from_mp3(music_path)
            
            # 음악 길이를 음성 길이에 맞춤
            if len(music) < len(speech):
                music = music * (len(speech) // len(music) + 1)
            music = music[:len(speech)]
            
            # 음악 볼륨 조절
            music = music - (10 * (1 - music_volume))  # dB 조절
            
            # 음성과 음악 합성
            combined = speech.overlay(music)
            
            combined.export(output_path, format='mp3')
            
            print(f"배경음악 추가 완료: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"배경음악 추가 중 오류: {e}")
            return speech_path
    
    def preview_audio(self, audio_path: str):
        """오디오 미리듣기"""
        
        try:
            # pygame이 없는 경우 대체 처리
            print(f"오디오 미리듣기 기능은 현재 비활성화되어 있습니다.")
            print(f"오디오 파일 위치: {audio_path}")
            print("시스템 기본 플레이어로 직접 재생해 주세요.")
            
        except Exception as e:
            print(f"오디오 미리듣기 중 오류: {e}")
