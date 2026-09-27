"""
Main Application Module
공학 쇼츠 생성 자동화 워크플로우 메인 통합 모듈
"""

import os
import sys
import argparse
import json
from typing import Dict
from dotenv import load_dotenv

# 모듈 임포트
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from script_analyzer import ScriptAnalyzer
from gpt_service import GPTService
from google_flow_service import GoogleFlowService
from keyframe_manager import KeyframeManager
from image_workflow import ImageWorkflow
from video_editor import VideoEditor
from tts_service import TTSService

# 로컬 AI 서비스 (선택적)
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
            
            # 강제로 Stable Diffusion 사용 시도
            try:
                self.google_flow_service = StableDiffusionService(
                    host=self.config.get('sd_host', 'http://127.0.0.1:7860')
                )
                print("Stable Diffusion 서비스 초기화 완료")
            except Exception as e:
                print(f"Stable Diffusion 초기화 실패: {e}")
                print("Google Flow 서비스로 대체")
                self.google_flow_service = GoogleFlowService(self.config)
        else:
            print("클라우드 AI 서비스 사용 모드")
            self.gpt_service = GPTService(self.config)
            self.google_flow_service = GoogleFlowService(self.config)
        
        self.keyframe_manager = KeyframeManager(self.config)
        self.image_workflow = ImageWorkflow(self.config)
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
    
    def generate_complete_video(self, script_file_path: str, options: Dict = None) -> Dict:
        """완전한 비디오 생성 워크플로우 실행"""
        
        if options is None:
            options = {}
        
        print("=== 공학 쇼츠 완전 자동화 워크플로우 시작 ===")
        
        results = {
            'success': False,
            'steps': {},
            'final_video_path': None
        }
        
        try:
            # 1단계: 스크립트 분석 및 키프레임 계산
            print("\n[1/6] 스크립트 분석 및 키프레임 계산...")
            script_analysis = self.script_analyzer.parse_markdown_file(script_file_path)
            keyframe_calculation = self.keyframe_manager.calculate_keyframes(script_analysis)
            
            results['steps']['script_analysis'] = {
                'title': script_analysis['title'],
                'duration': script_analysis['duration'],
                'num_keyframes': keyframe_calculation['total_keyframes']
            }
            
            print(f"   제목: {script_analysis['title']}")
            print(f"   음성 길이: {script_analysis['duration']}초")
            print(f"   키프레임 수: {keyframe_calculation['total_keyframes']}")
            
            # 2단계: 이미지 생성 (기본 + 인포그래픽)
            print("\n[2/6] 이미지 생성 워크플로우 실행...")
            image_result = self.image_workflow.execute_full_workflow(script_file_path)
            
            results['steps']['image_generation'] = {
                'total_images': len(image_result['generated_images']),
                'output_directory': image_result['output_directory']
            }
            
            print(f"   생성된 이미지 쌍: {len(image_result['generated_images'])}")
            
            # 3단계: 음성 생성
            print("\n[3/6] 음성 생성...")
            if options.get('skip_tts', False):
                print("   TTS 건너뜀 (옵션 설정)")
                audio_path = None
            else:
                audio_path = self.tts_service.generate_speech_from_script(
                    script_analysis['script_text'],
                    method=options.get('tts_method', 'auto')
                )
                results['steps']['audio_generation'] = {
                    'audio_path': audio_path
                }
                print(f"   음성 파일: {audio_path}")
            
            # 4단계: 클립 순서 정리 (GPT 활용)
            print("\n[4/6] 클립 순서 정리...")
            keyframes = self.keyframe_manager.keyframes
            organized_keyframes = self.video_editor.organize_clips_with_gpt(
                keyframes, self.gpt_service
            )
            
            results['steps']['clip_organization'] = {
                'organized': True
            }
            
            print("   클립 순서 정리 완료")
            
            # 5단계: 비디오 제작
            print("\n[5/6] 비디오 제작...")
            video_path = self.video_editor.create_motion_graphics_video(
                organized_keyframes,
                audio_path
            )
            
            results['steps']['video_creation'] = {
                'video_path': video_path
            }
            
            print(f"   비디오 파일: {video_path}")
            
            # 6단계: 플랫폼 최적화
            print("\n[6/6] 플랫폼 최적화...")
            platform = options.get('platform', 'youtube')
            optimized_video = self.video_editor.optimize_video_for_platform(
                video_path, platform
            )
            
            results['steps']['platform_optimization'] = {
                'platform': platform,
                'optimized_path': optimized_video
            }
            
            print(f"   최적화된 비디오: {optimized_video}")
            
            # 워터마크 추가 (옵션)
            if options.get('watermark'):
                print("\n[추가] 워터마크 추가...")
                watermarked_video = self.video_editor.add_watermark(
                    optimized_video,
                    options['watermark']
                )
                results['steps']['watermark'] = {
                    'watermarked_path': watermarked_video
                }
                optimized_video = watermarked_video
            
            # 최종 결과
            results['success'] = True
            results['final_video_path'] = optimized_video
            
            print("\n=== 워크플로우 완료 ===")
            print(f"최종 비디오: {optimized_video}")
            
        except Exception as e:
            print(f"\n=== 워크플로우 실패 ===")
            print(f"오류: {e}")
            results['error'] = str(e)
        
        return results
    
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
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def generate_audio_only(self, script_file_path: str, method: str = 'auto') -> Dict:
        """음성 생성만 수행"""
        
        print("=== 음성 생성 전용 워크플로우 ===")
        
        try:
            script_analysis = self.script_analyzer.parse_markdown_file(script_file_path)
            audio_path = self.tts_service.generate_speech_from_script(
                script_analysis['script_text'],
                method=method
            )
            
            return {
                'success': True,
                'audio_path': audio_path,
                'script_text': script_analysis['script_text']
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_preview(self, script_file_path: str) -> Dict:
        """프리뷰 비디오 생성"""
        
        print("=== 프리뷰 생성 워크플로우 ===")
        
        try:
            # 이미지 생성
            image_result = self.image_workflow.execute_full_workflow(script_file_path)
            
            # 프리뷰 비디오 생성
            preview_path = self.video_editor.create_preview_video(
                self.keyframe_manager.keyframes
            )
            
            return {
                'success': True,
                'preview_path': preview_path,
                'image_result': image_result
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def batch_process(self, script_directory: str, options: Dict = None) -> Dict:
        """디렉토리 내 모든 스크립트 일괄 처리"""
        
        print("=== 일괄 처리 워크플로우 ===")
        
        if options is None:
            options = {}
        
        # 스크립트 파일 찾기
        script_files = []
        for file in os.listdir(script_directory):
            if file.endswith('.md') or file.endswith('.txt'):
                script_files.append(os.path.join(script_directory, file))
        
        if not script_files:
            return {
                'success': False,
                'error': '처리할 스크립트 파일이 없습니다.'
            }
        
        print(f"발견된 스크립트 파일: {len(script_files)}개")
        
        results = []
        
        for script_file in script_files:
            print(f"\n처리 중: {os.path.basename(script_file)}")
            
            try:
                if options.get('images_only', False):
                    result = self.generate_images_only(script_file)
                elif options.get('audio_only', False):
                    result = self.generate_audio_only(script_file)
                else:
                    result = self.generate_complete_video(script_file, options)
                
                results.append({
                    'script_file': script_file,
                    'result': result
                })
                
            except Exception as e:
                print(f"파일 처리 실패: {script_file}, 오류: {e}")
                results.append({
                    'script_file': script_file,
                    'success': False,
                    'error': str(e)
                })
        
        # 결과 요약
        successful = sum(1 for r in results if r.get('result', {}).get('success', False))
        
        return {
            'success': True,
            'total_files': len(script_files),
            'successful': successful,
            'failed': len(script_files) - successful,
            'results': results
        }


def main():
    """메인 실행 함수"""
    
    parser = argparse.ArgumentParser(description='공학 쇼츠 자동 생성기')
    
    parser.add_argument('script', help='스크립트 파일 경로')
    parser.add_argument('--config', help='설정 파일 경로', default=None)
    parser.add_argument('--mode', choices=['complete', 'images', 'audio', 'preview', 'batch'],
                       default='complete', help='실행 모드')
    parser.add_argument('--batch-dir', help='일괄 처리 모드时 디렉토리 경로')
    parser.add_argument('--skip-tts', action='store_true', help='TTS 건너뛰기')
    parser.add_argument('--tts-method', choices=['auto', 'google', 'gtts'], 
                       default='auto', help='TTS 방법')
    parser.add_argument('--platform', choices=['youtube', 'instagram', 'tiktok'],
                       default='youtube', help='최적화 대상 플랫폼')
    parser.add_argument('--watermark', help='워터마크 텍스트')
    
    args = parser.parse_args()
    
    # 생성자 초기화
    generator = EngineeringShortsGenerator(args.config)
    
    # 모드에 따른 실행
    if args.mode == 'complete':
        options = {
            'skip_tts': args.skip_tts,
            'tts_method': args.tts_method,
            'platform': args.platform,
            'watermark': args.watermark
        }
        result = generator.generate_complete_video(args.script, options)
    
    elif args.mode == 'images':
        result = generator.generate_images_only(args.script)
    
    elif args.mode == 'audio':
        result = generator.generate_audio_only(args.script, args.tts_method)
    
    elif args.mode == 'preview':
        result = generator.create_preview(args.script)
    
    elif args.mode == 'batch':
        if not args.batch_dir:
            print("일괄 처리 모드에는 --batch-dir가 필요합니다.")
            return
        
        options = {
            'skip_tts': args.skip_tts,
            'tts_method': args.tts_method,
            'platform': args.platform
        }
        result = generator.batch_process(args.batch_dir, options)
    
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
