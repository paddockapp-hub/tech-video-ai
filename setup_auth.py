"""
인증 설정 마법사
Firebase와 GitHub OAuth를 쉽게 설정하도록 도와주는 설정 스크립트
"""

import os
import sys
import json
from pathlib import Path

# UTF-8 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def check_env_file():
    """환경 변수 파일 확인"""
    env_file = Path('.env')
    env_example = Path('.env.example')
    
    if not env_file.exists():
        print("=== .env 파일 생성 ===")
        if env_example.exists():
            import shutil
            shutil.copy(env_example, env_file)
            print(f"[SUCCESS] .env.example에서 .env 파일 생성 완료")
        else:
            with open(env_file, 'w', encoding='utf-8') as f:
                f.write("# Engineering Shorts Generator Environment Variables\n")
                f.write("# 인증 및 스토리지 설정\n\n")
                f.write("# Firebase 설정\n")
                f.write("FIREBASE_ENABLED=false\n")
                f.write("FIREBASE_KEY_PATH=firebase-adminsdk-key.json\n\n")
                f.write("# GitHub OAuth 설정\n")
                f.write("GITHUB_ENABLED=false\n")
                f.write("GITHUB_CLIENT_ID=\n")
                f.write("GITHUB_CLIENT_SECRET=\n")
                f.write("GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback\n\n")
                f.write("# 스토리지 설정\n")
                f.write("STORAGE_TYPE=local\n")
                f.write("LOCAL_STORAGE_DIR=uploads\n")
            print(f"[SUCCESS] .env 파일 생성 완료")
    else:
        print(f"[INFO] .env 파일이 이미 존재합니다")
    
    return env_file

def setup_firebase():
    """Firebase 설정"""
    print("\n=== Firebase 설정 ===")
    print("Firebase 설정을 완료하려면 다음 단계를 따르세요:")
    print("1. Firebase Console 접속: https://console.firebase.google.com/")
    print("2. 프로젝트 생성")
    print("3. Authentication 활성화 (Email/Password)")
    print("4. 서비스 계정 키 다운로드 (JSON 형식)")
    print("5. 다운로드한 파일을 firebase-adminsdk-key.json으로 이름 변경")
    print("6. 프로젝트 루트 디렉토리에 파일 배치")
    
    firebase_key = input("\nFirebase 서비스 계정 키 파일 경로 (또는 엔터로 건너뛰기): ").strip()
    
    if firebase_key:
        if os.path.exists(firebase_key):
            # 파일을 프로젝트 루트로 복사
            import shutil
            dest_path = "firebase-adminsdk-key.json"
            shutil.copy(firebase_key, dest_path)
            print(f"[SUCCESS] Firebase 키 파일 복사 완료: {dest_path}")
            
            # .env 파일 업데이트
            update_env_file("FIREBASE_ENABLED", "true")
            update_env_file("FIREBASE_KEY_PATH", "firebase-adminsdk-key.json")
            
            print("[SUCCESS] Firebase 설정 완료")
            return True
        else:
            print(f"[ERROR] 파일을 찾을 수 없습니다: {firebase_key}")
            return False
    else:
        print("[INFO] Firebase 설정 건너뜀")
        return False

def setup_github_oauth():
    """GitHub OAuth 설정"""
    print("\n=== GitHub OAuth 설정 ===")
    print("GitHub OAuth 설정을 완료하려면 다음 단계를 따르세요:")
    print("1. GitHub 접속: https://github.com/settings/developers")
    print("2. OAuth Apps → New OAuth App")
    print("3. 앱 정보 입력:")
    print("   - Application name: Engineering Shorts Generator")
    print("   - Homepage URL: http://localhost:8000")
    print("   - Authorization callback URL: http://localhost:8000/auth/github/callback")
    print("4. Client ID와 Client Secret 복사")
    
    client_id = input("\nGitHub Client ID (또는 엔터로 건너뛰기): ").strip()
    client_secret = input("GitHub Client Secret (또는 엔터로 건너뛰기): ").strip()
    
    if client_id and client_secret:
        # .env 파일 업데이트
        update_env_file("GITHUB_ENABLED", "true")
        update_env_file("GITHUB_CLIENT_ID", client_id)
        update_env_file("GITHUB_CLIENT_SECRET", client_secret)
        
        print("[SUCCESS] GitHub OAuth 설정 완료")
        return True
    else:
        print("[INFO] GitHub OAuth 설정 건너뜀")
        return False

def update_env_file(key, value):
    """환경 변수 파일 업데이트"""
    env_file = Path('.env')
    
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # 키가 있는지 확인하고 업데이트
        key_found = False
        for i, line in enumerate(lines):
            if line.startswith(f"{key}="):
                lines[i] = f"{key}={value}\n"
                key_found = True
                break
        
        # 키가 없으면 추가
        if not key_found:
            lines.append(f"{key}={value}\n")
        
        with open(env_file, 'w', encoding='utf-8') as f:
            f.writelines(lines)
    else:
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(f"{key}={value}\n")

def check_current_status():
    """현재 설정 상태 확인"""
    print("\n=== 현재 설정 상태 ===")
    
    # Firebase 키 파일 확인
    firebase_key = Path('firebase-adminsdk-key.json')
    if firebase_key.exists():
        print("[FIREBASE] 키 파일 존재: YES")
    else:
        print("[FIREBASE] 키 파일 존재: NO")
    
    # GitHub OAuth 설정 확인
    env_file = Path('.env')
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'GITHUB_ENABLED=true' in content:
            print("[GITHUB] OAuth 활성화: YES")
        else:
            print("[GITHUB] OAuth 활성화: NO")
        
        if 'GITHUB_CLIENT_ID=' in content and 'GITHUB_CLIENT_SECRET=' in content:
            client_id_line = [line for line in content.split('\n') if line.startswith('GITHUB_CLIENT_ID=')]
            if client_id_line and client_id_line[0].split('=')[1].strip():
                print("[GITHUB] Client ID 설정: YES")
            else:
                print("[GITHUB] Client ID 설정: NO")
        else:
            print("[GITHUB] Client ID 설정: NO")
    else:
        print("[GITHUB] OAuth 활성화: NO")
        print("[GITHUB] Client ID 설정: NO")

def run_tests():
    """설정 테스트"""
    print("\n=== 설정 테스트 ===")
    
    try:
        # 시스템 임포트 테스트
        src_path = Path('src')
        if src_path.exists():
            sys.path.insert(0, str(src_path))
        
        from auth_service import AuthService
        from storage_service import StorageService
        
        print("[SUCCESS] 인증/스토리지 모듈 임포트 성공")
        
        # 환경 변수 로드
        from dotenv import load_dotenv
        load_dotenv()
        
        # 인증 서비스 테스트
        config = {
            'firebase_enabled': os.getenv('FIREBASE_ENABLED', 'false').lower() == 'true',
            'firebase_key_path': os.getenv('FIREBASE_KEY_PATH'),
            'github_enabled': os.getenv('GITHUB_ENABLED', 'false').lower() == 'true',
            'github_client_id': os.getenv('GITHUB_CLIENT_ID'),
            'github_client_secret': os.getenv('GITHUB_CLIENT_SECRET'),
            'github_redirect_uri': os.getenv('GITHUB_REDIRECT_URI', 'http://localhost:8000/auth/github/callback')
        }
        
        auth_service = AuthService(config)
        
        if auth_service.firebase_initialized:
            print("[SUCCESS] Firebase 초기화 성공")
        else:
            print("[INFO] Firebase 초기화되지 않음 (설정 필요)")
        
        if auth_service.github_session:
            print("[SUCCESS] GitHub OAuth 초기화 성공")
        else:
            print("[INFO] GitHub OAuth 초기화되지 않음 (설정 필요)")
        
        print("\n[SUCCESS] 시스템이 정상적으로 작동합니다")
        print("Firebase 또는 GitHub OAuth를 사용하려면 설정을 완료하세요")
        
    except Exception as e:
        print(f"[ERROR] 테스트 실패: {e}")

def main():
    """메인 함수"""
    print("=== Engineering Shorts Generator 인증 설정 마법사 ===")
    print("Firebase와 GitHub OAuth를 쉽게 설정하도록 도와드립니다\n")
    
    # 현재 상태 확인
    check_current_status()
    
    # 환경 파일 확인
    check_env_file()
    
    # Firebase 설정
    firebase_setup = setup_firebase()
    
    # GitHub OAuth 설정
    github_setup = setup_github_oauth()
    
    # 최종 상태 확인
    print("\n=== 최종 설정 상태 ===")
    check_current_status()
    
    # 테스트 실행
    run_tests()
    
    print("\n=== 설정 완료 ===")
    print("이제 다음 명령어로 시스템을 실행할 수 있습니다:")
    print("  python src/integrated_main.py --mode server --port 8000")
    print("  python src/local_main.py example_script.md --mode video")

if __name__ == '__main__':
    main()