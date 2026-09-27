"""
Integrated Main Module
인증, 스토리지, 비디오 생성 통합 시스템
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
from auth_service import AuthService
from storage_service import StorageService
from local_main import EngineeringShortsGenerator

# 웹 서버 임포트 (선택적)
try:
    from web_server import WebServer
    WEB_SERVER_AVAILABLE = True
except ImportError:
    WEB_SERVER_AVAILABLE = False
    print("웹 서버 모듈을 사용할 수 없습니다. 웹 서버 기능이 제한됩니다.")


class IntegratedSystem:
    def __init__(self, config_path: str = None):
        """통합 시스템 초기화"""
        
        # 환경 변수 로드
        load_dotenv()
        
        # 설정 로드
        self.config = self._load_config(config_path)
        
        # 서비스 초기화
        self.short_generator = EngineeringShortsGenerator(config_path)
        self.auth_service = AuthService(self.config)
        self.storage_service = StorageService(self.config)
        
        # 웹 서비스 초기화 (선택적)
        if WEB_SERVER_AVAILABLE:
            self.web_server = WebServer(self.config)
        else:
            self.web_server = None
        
        print("=== 통합 시스템 초기화 완료 ===")
    
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
            'sd_host': os.getenv('SD_HOST', 'http://127.0.0.1:7860'),
            # 인증 설정
            'firebase_enabled': os.getenv('FIREBASE_ENABLED', 'false').lower() == 'true',
            'firebase_key_path': os.getenv('FIREBASE_KEY_PATH'),
            'github_enabled': os.getenv('GITHUB_ENABLED', 'false').lower() == 'true',
            'github_client_id': os.getenv('GITHUB_CLIENT_ID'),
            'github_client_secret': os.getenv('GITHUB_CLIENT_SECRET'),
            'github_redirect_uri': os.getenv('GITHUB_REDIRECT_URI', 'http://localhost:8000/auth/github/callback'),
            # 스토리지 설정
            'storage_type': os.getenv('STORAGE_TYPE', 'local'),
            'local_storage_dir': os.getenv('LOCAL_STORAGE_DIR', 'uploads'),
            's3_bucket_name': os.getenv('S3_BUCKET_NAME'),
            'aws_access_key_id': os.getenv('AWS_ACCESS_KEY_ID'),
            'aws_secret_access_key': os.getenv('AWS_SECRET_ACCESS_KEY'),
            'aws_region': os.getenv('AWS_REGION', 'us-east-1'),
            # 웹 서버 설정
            'secret_key': os.getenv('SECRET_KEY', 'engineering-shorts-secret')
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"설정 파일 로드 중 오류: {e}")
        
        return default_config
    
    def generate_authenticated_video(self, script_file_path: str, user_id: str) -> Dict:
        """인증된 사용자의 비디오 생성"""
        
        print(f"=== 사용자 {user_id} 비디오 생성 시작 ===")
        
        try:
            # 1단계: 비디오 생성
            video_result = self.short_generator.generate_full_video(script_file_path)
            
            if not video_result['success']:
                return {
                    'success': False,
                    'error': video_result.get('error'),
                    'user_id': user_id
                }
            
            # 2단계: 결과 파일 업로드
            video_file = video_result.get('video_file')
            audio_file = video_result.get('audio_file')
            
            upload_results = []
            
            if video_file and os.path.exists(video_file):
                video_upload = self.storage_service.upload_file(
                    video_file,
                    f"videos/{user_id}/{os.path.basename(video_file)}",
                    {'user_id': user_id, 'type': 'video'}
                )
                upload_results.append(video_upload)
            
            if audio_file and os.path.exists(audio_file):
                audio_upload = self.storage_service.upload_file(
                    audio_file,
                    f"audio/{user_id}/{os.path(audio_file)}",
                    {'user_id': user_id, 'type': 'audio'}
                )
                upload_results.append(audio_upload)
            
            return {
                'success': True,
                'user_id': user_id,
                'video_result': video_result,
                'upload_results': upload_results,
                'message': '인증된 비디오 생성 완료'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'인증된 비디오 생성 실패: {str(e)}',
                'user_id': user_id
            }
    
    def start_web_server(self, host='0.0.0.0', port=8000):
        """웹 서버 시작"""
        if not WEB_SERVER_AVAILABLE or not self.web_server:
            print("웹 서버를 시작할 수 없습니다. Flask가 설치되지 않았습니다.")
            return
        
        print("=== 웹 서버 시작 ===")
        self.web_server.run(host=host, port=port)


def main():
    """메인 실행 함수"""
    
    parser = argparse.ArgumentParser(description='공학 쇼츠 자동 생성기 - 통합 시스템')
    
    parser.add_argument('--mode', choices=['video', 'images', 'server'], default='video', help='실행 모드')
    parser.add_argument('--script', help='스크립트 파일 경로')
    parser.add_argument('--server', action='store_true', help='웹 서버 모드')
    parser.add_argument('--host', default='0.0.0.0', help='서버 호스트')
    parser.add_argument('--port', type=int, default=8000, help='서버 포트')
    
    args = parser.parse_args()
    
    # 통합 시스템 초기화
    system = IntegratedSystem()
    
    # 모드에 따른 실행
    if args.mode == 'server' or args.server:
        system.start_web_server(args.host, args.port)
    elif args.mode == 'video' and args.script:
        result = system.short_generator.generate_full_video(args.script)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif args.mode == 'images' and args.script:
        result = system.short_generator.generate_images_only(args.script)
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()