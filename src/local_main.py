"""
로컬 GPT 전용 메인 파일
import 문제 해결 버전
"""

import os
import sys
import argparse
import json
from typing import Dict
from dotenv import load_dotenv

# 현재 디렉토리를 경로에 추가
sys.path.insert(0, os.path.dirname(__file__))

# 모듈 임포트
from script_analyzer import ScriptAnalyzer
from gpt_service import GPTService
from google_flow_service import GoogleFlowService
from keyframe_manager import KeyframeManager
from image_workflow import ImageWorkflow
from video_editor import VideoEditor
from tts_service import TTSService

# 로컬 AI 서비스
try:
    from ollama_service import OllamaService
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

try:
    from stable_diffusion_service import StableDiffusionService
    STABLE_DIFFUSION_AVAILABLE = True
except ImportError:
    STABLE_DIFFUSION_AVAILABLE = False


class EngineeringShortsGenerator:
    def __init__(self, config_path: str = None):
        """설정 로드 및 초기화"""
        
        # 환경 변수 로드
        load_dotenv()
        
        # 설정 로드
        self.config = self._load_config(config_path)
        
        # 서비스 초기화
        self.script_analyzer = ScriptAnalyzer(self.config)
        
        # AI 서비스 선택 (로컬 vs 클라우드)
        use_local_ai = str(self.config.get('use_local_ai', 'false')).lower() == 'true'
        
        if use_local_ai:
            print("로컬 AI 서비스 사용 모드")
            # 강제로 Ollama 사용
            try:
                self.gpt_service = OllamaService(
                    host=self.config.get('ollama_host', 'http://localhost:11434'),
                    model=self.config.get('ollama_model', 'llama3.2')
                )
                print("Ollama 서비스 초기화 완료")
            except Exception as e:
                print(f"Ollama 초기화 실패: {e}")
                print("GPT 서비스로 대체")
                self.gpt_service = GPTService(self.config)
            
            # 이미지 생성은 Google Flow 사용 (로컬 Stable Diffusion은 호환 문제로 건너뜀)
            print("이미지 생성은 Google Flow API 사용")
            self.google_flow_service = GoogleFlowService(self.config)
        else:
            print("클라우드 AI 서비스 사용 모드")
            self.gpt_service = GPTService(self.config)
            self.google_flow_service = GoogleFlowService(self.config)
        
        self.keyframe_manager = KeyframeManager(self.config)
        
        # ImageWorkflow에 초기화된 서비스 전달
        self.image_workflow = ImageWorkflow(
            self.config,
            gpt_service=self.gpt_service,
            google_flow_service=self.google_flow_service,
            keyframe_manager=self.keyframe_manager
        )
        
        self.video_editor = VideoEditor(self.config)
        self.tts_service = TTSService(self.config)
        
        print("=== 공학 쇼츠 생성자 초기화 완료 ===")
    
    def _load_config(self, config_path: str = None) -> Dict:
        """설정 파일 로드"""
        
        default_config = {
            'openai_api_key': os.getenv('OPENAI_API_KEY'),
            'openai_model': os.getenv('OPENAI_MODEL', 'gpt-4'),
            'google_api_key': os.getenv('GOOGLE_API_KEY'),
            'google_model': os.getenv('GOOGLE_MODEL', 'gemini-pro'),
            'google_tts_enabled': os.getenv('GOOGLE_TTS_ENABLED', 'false').lower() == 'true',
            'video_duration': int(os.getenv('VIDEO_DURATION', 30)),
            'fps': int(os.getenv('FPS', 30)),
            'image_width': int(os.getenv('IMAGE_WIDTH', 1080)),
            'image_height': int(os.getenv('IMAGE_HEIGHT', 1920)),
            'output_dir': os.getenv('OUTPUT_DIR', 'output'),
            'temp_dir': os.getenv('TEMP_DIR', 'temp'),
            # 로컬 AI 설정
            'use_local_ai': os.getenv('USE_LOCAL_AI', 'false').lower() == 'true',
            'ollama_host': os.getenv('OLLAMA_HOST', 'http://localhost:11434'),
            'ollama_model': os.getenv('OLLAMA_MODEL', 'llama3.2'),
            'sd_host': os.getenv('SD_HOST', 'http://127.0.0.1:7860')
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"설정 파일 로드 중 오류: {e}")
        
        return default_config
    
    def generate_images_only(self, script_file_path: str) -> Dict:
        """이미지 생성만 수행"""
        
        print("=== 이미지 생성 전용 워크플로우 ===")
        
        try:
            result = self.image_workflow.execute_full_workflow(script_file_path)
            
            # 매니페스트 내보내기
            manifest_path = self.image_workflow.export_image_manifest()
            
            return {
                'success': True,
                'result': result,
                'manifest_path': manifest_path
            }
            
        except FileNotFoundError as e:
            return {
                'success': False,
                'error': f'파일을 찾을 수 없습니다: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'이미지 생성 중 오류 발생: {str(e)}'
            }
    
    def generate_full_video(self, script_file_path: str) -> Dict:
        """전체 비디오 생성 워크플로우"""
        
        print("=== 전체 비디오 생성 워크플로우 ===")
        
        try:
            # 1단계: 이미지 생성
            print("1단계: 이미지 생성 중...")
            image_result = self.image_workflow.execute_full_workflow(script_file_path)
            
            if not image_result['success']:
                return {
                    'success': False,
                    'error': '이미지 생성 실패',
                    'details': image_result
                }
            
            # 2단계: TTS 생성
            print("2단계: TTS 생성 중...")
            script_analysis = image_result['script_analysis']
            try:
                audio_file = self.tts_service.generate_speech_from_script(script_analysis['script_text'])
            except Exception as e:
                return {
                    'success': False,
                    'error': f'TTS 생성 실패: {str(e)}'
                }
            
            # 3단계: 비디오 편집
            print("3단계: 비디오 편집 중...")
            keyframes = self.keyframe_manager.keyframes
            try:
                video_file = self.video_editor.create_motion_graphics_video(
                    keyframes, 
                    audio_file
                )
            except Exception as e:
                return {
                    'success': False,
                    'error': f'비디오 편집 실패: {str(e)}',
                    'audio_file': audio_file,
                    'image_result': image_result
                }
            
            return {
                'success': True,
                'video_file': video_file,
                'audio_file': audio_file,
                'image_result': image_result
            }
            
        except FileNotFoundError as e:
            return {
                'success': False,
                'error': f'파일을 찾을 수 없습니다: {str(e)}'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'비디오 생성 중 오류 발생: {str(e)}'
            }


def main():
    """메인 실행 함수"""
    
    parser = argparse.ArgumentParser(description='공학 쇼츠 자동 생성기 (로컬 GPT 버전)')
    
    parser.add_argument('script', help='스크립트 파일 경로')
    parser.add_argument('--mode', choices=['images', 'video'], default='images', help='실행 모드')
    
    args = parser.parse_args()
    
    # 생성자 초기화
    generator = EngineeringShortsGenerator()
    
    # 모드에 따른 실행
    if args.mode == 'images':
        result = generator.generate_images_only(args.script)
    elif args.mode == 'video':
        result = generator.generate_full_video(args.script)
    
    # 결과 출력
    print("\n=== 최종 결과 ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 결과 파일 저장
    result_path = os.path.join(generator.config['output_dir'], 'result.json')
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"\n결과가 저장되었습니다: {result_path}")


if __name__ == '__main__':
    main()