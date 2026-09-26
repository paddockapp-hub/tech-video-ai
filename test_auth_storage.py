"""
로컬 인증/스토리지 시스템 테스트
실제 설치된 패키지로 로컬 스토리지 기능 테스트
"""

import os
import sys
import json
from dotenv import load_dotenv

# UTF-8 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# src 디렉토리를 경로에 추가
src_path = os.path.join(os.path.dirname(__file__), 'src')
if src_path not in sys.path:
    sys.path.insert(0, src_path)

# 환경 변수 로드
load_dotenv()

from auth_service import AuthService
from storage_service import StorageService

def test_local_storage():
    """로컬 스토리지 테스트"""
    
    print("=== 로컬 스토리지 테스트 시작 ===")
    
    # 로컬 스토리지 설정
    config = {
        'storage_type': 'local',
        'local_storage_dir': 'test_uploads',
        'firebase_enabled': False,
        'github_enabled': False
    }
    
    # 스토리지 서비스 초기화
    storage_service = StorageService(config)
    
    # 테스트 파일 생성
    test_file = "test_sample.txt"
    with open(test_file, 'w', encoding='utf-8') as f:
        f.write("테스트 파일 내용입니다.")
    
    print(f"테스트 파일 생성: {test_file}")
    
    # 파일 업로드 테스트
    print("파일 업로드 테스트...")
    upload_result = storage_service.upload_file(
        test_file,
        "test/sample.txt",
        {'test': 'metadata'}
    )
    
    print(f"업로드 결과: {json.dumps(upload_result, indent=2, ensure_ascii=False)}")
    
    if upload_result['success']:
        print("[SUCCESS] 파일 업로드 성공")
        
        # 파일 정보 조회 테스트
        print("파일 정보 조회 테스트...")
        file_info = storage_service.get_file_info(upload_result['storage_path'])
        print(f"파일 정보: {json.dumps(file_info, indent=2, ensure_ascii=False)}")
        
        if file_info['success']:
            print("[SUCCESS] 파일 정보 조회 성공")
        else:
            print("[FAIL] 파일 정보 조회 실패")
    else:
        print("[FAIL] 파일 업로드 실패")
    
    # 테스트 파일 삭제
    if os.path.exists(test_file):
        os.remove(test_file)
    
    print("=== 로컬 스토리지 테스트 완료 ===")

def test_auth_services():
    """인증 서비스 테스트 (Firebase 없이 로컬 테스트)"""
    
    print("=== 인증 서비스 테스트 시작 ===")
    
    # 로컬 인증 설정 (Firebase 비활성화)
    config = {
        'firebase_enabled': False,
        'github_enabled': False
    }
    
    # 인증 서비스 초기화
    auth_service = AuthService(config)
    
    print("인증 서비스 초기화 완료")
    print("Firebase 상태:", "활성화" if auth_service.firebase_initialized else "비활성화")
    print("GitHub OAuth 상태:", "활성화" if auth_service.github_session else "비활성화")
    
    # Firebase 비활성화 상태에서의 테스트
    print("Firebase 비활성화 상태 테스트...")
    result = auth_service.login_user("test@example.com", "password")
    print(f"로그인 결과: {json.dumps(result, indent=2, ensure_ascii=False)}")
    
    if not result['success']:
        print("[SUCCESS] Firebase 비활성화 상태 정상 작동")
    else:
        print("[FAIL] Firebase 비활성화 상태 오작동")
    
    print("=== 인증 서비스 테스트 완료 ===")

def test_web_server_import():
    """웹 서버 임포트 테스트"""
    
    print("=== 웹 서버 임포트 테스트 시작 ===")
    
    try:
        from web_server import WebServer
        print("[SUCCESS] 웹 서버 모듈 임포트 성공")
        
        # 웹 서버 초기화 테스트
        config = {
            'secret_key': 'test-secret-key',
            'firebase_enabled': False,
            'github_enabled': False,
            'storage_type': 'local',
            'local_storage_dir': 'test_uploads'
        }
        
        web_server = WebServer(config)
        
        if web_server.app:
            print("[SUCCESS] 웹 서버 초기화 성공")
            print("Flask 앱 상태: 활성화")
        else:
            print("[FAIL] 웹 서버 초기화 실패")
            
    except Exception as e:
        print(f"[FAIL] 웹 서버 임포트 실패: {e}")
    
    print("=== 웹 서버 임포트 테스트 완료 ===")

if __name__ == '__main__':
    print("실제 패키지 설치 테스트 시작\n")
    
    # 인증 서비스 테스트
    test_auth_services()
    print()
    
    # 스토리지 서비스 테스트
    test_local_storage()
    print()
    
    # 웹 서버 테스트
    test_web_server_import()
    print()
    
    print("모든 테스트 완료")