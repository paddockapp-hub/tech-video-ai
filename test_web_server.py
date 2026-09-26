"""
웹 서버 API 테스트
"""

import requests
import json
import os
import sys

# UTF-8 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def test_health():
    """헬스 체크 테스트"""
    print("=== 헬스 체크 테스트 ===")
    try:
        response = requests.get(f"{BASE_URL}/health")
        print(f"상태 코드: {response.status_code}")
        print(f"응답: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"오류: {e}")
        return False

def test_auth_register():
    """사용자 등록 테스트"""
    print("=== 사용자 등록 테스트 ===")
    try:
        data = {
            "email": "test@example.com",
            "password": "test123",
            "metadata": {"display_name": "Test User"}
        }
        response = requests.post(f"{BASE_URL}/auth/register", json=data)
        print(f"상태 코드: {response.status_code}")
        print(f"응답: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"오류: {e}")
        return False

def test_auth_login():
    """사용자 로그인 테스트"""
    print("=== 사용자 로그인 테스트 ===")
    try:
        data = {
            "email": "test@example.com",
            "password": "test123"
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=data)
        print(f"상태 코드: {response.status_code}")
        print(f"응답: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        return response.status_code == 200
    except Exception as e:
        print(f"오류: {e}")
        return False

def test_storage_upload():
    """파일 업로드 테스트"""
    print("=== 파일 업로드 테스트 ===")
    try:
        # 테스트 파일 생성
        test_file = "test_upload.txt"
        with open(test_file, 'w', encoding='utf-8') as f:
            f.write("테스트 업로드 파일")
        
        files = {'file': open(test_file, 'rb')}
        data = {
            'destination': 'test/uploaded.txt',
            'metadata': json.dumps({'test': 'metadata'})
        }
        
        response = requests.post(f"{BASE_URL}/storage/upload", files=files, data=data)
        print(f"상태 코드: {response.status_code}")
        print(f"응답: {json.dumps(response.json(), indent=2, ensure_ascii=False)}")
        
        # 파일 삭제
        if os.path.exists(test_file):
            os.remove(test_file)
            
        return response.status_code == 200
    except Exception as e:
        print(f"오류: {e}")
        return False

if __name__ == '__main__':
    print("웹 서버 API 테스트 시작\n")
    
    # 헬스 체크
    test_health()
    print()
    
    # 인증 테스트 (Firebase 비활성화 상태)
    test_auth_register()
    print()
    test_auth_login()
    print()
    
    # 스토리지 테스트
    test_storage_upload()
    print()
    
    print("테스트 완료")