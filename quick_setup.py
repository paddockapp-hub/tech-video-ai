"""
빠른 설정 스크립트
사용자가 설정 파일만 배치하면 자동으로 인식
"""

import os
import sys
from pathlib import Path

# UTF-8 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

def auto_detect_settings():
    """설정 자동 감지"""
    print("=== 설정 자동 감지 ===\n")
    
    # 프로젝트 루트 확인
    project_root = Path(__file__).parent
    os.chdir(project_root)
    
    # Firebase 키 파일 확인
    firebase_key = project_root / 'firebase-adminsdk-key.json'
    firebase_status = "활성화" if firebase_key.exists() else "비활성화"
    print(f"[FIREBASE] 서비스 계정 키: {firebase_status}")
    
    # GitHub OAuth 설정 확인
    env_file = project_root / '.env'
    github_status = "비활성화"
    
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'GITHUB_ENABLED=true' in content:
            github_client_id = None
            github_client_secret = None
            
            for line in content.split('\n'):
                if line.startswith('GITHUB_CLIENT_ID='):
                    github_client_id = line.split('=')[1].strip()
                elif line.startswith('GITHUB_CLIENT_SECRET='):
                    github_client_secret = line.split('=')[1].strip()
            
            if github_client_id and github_client_secret:
                github_status = "활성화"
    
    print(f"[GITHUB] OAuth: {github_status}")
    
    # .env 파일 자동 업데이트
    auto_update_env(firebase_key.exists(), github_status == "활성화")
    
    print("\n=== 설정 완료 ===")
    print("시스템을 실행하려면:")
    print("  python src/integrated_main.py --mode server --port 8000")
    print("  python src/local_main.py example_script.md --mode video")

def auto_update_env(firebase_exists, github_enabled):
    """환경 변수 자동 업데이트"""
    env_file = Path('.env')
    
    if not env_file.exists():
        # .env 파일 생성
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write("# Engineering Shorts Generator Environment Variables\n\n")
            f.write(f"# Firebase 설정\n")
            f.write(f"FIREBASE_ENABLED={'true' if firebase_exists else 'false'}\n")
            f.write(f"FIREBASE_KEY_PATH=firebase-adminsdk-key.json\n\n")
            f.write(f"# GitHub OAuth 설정\n")
            f.write(f"GITHUB_ENABLED={'true' if github_enabled else 'false'}\n")
            f.write(f"GITHUB_CLIENT_ID=\n")
            f.write(f"GITHUB_CLIENT_SECRET=\n")
            f.write(f"GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback\n\n")
            f.write(f"# 스토리지 설정\n")
            f.write(f"STORAGE_TYPE=local\n")
            f.write(f"LOCAL_STORAGE_DIR=uploads\n")
        print("[SUCCESS] .env 파일 생성 완료")
    else:
        # 기존 .env 파일 업데이트
        with open(env_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        updated = False
        for i, line in enumerate(lines):
            if line.startswith('FIREBASE_ENABLED='):
                lines[i] = f"FIREBASE_ENABLED={'true' if firebase_exists else 'false'}\n"
                updated = True
            elif line.startswith('GITHUB_ENABLED='):
                lines[i] = f"GITHUB_ENABLED={'true' if github_enabled else 'false'}\n"
                updated = True
        
        if updated:
            with open(env_file, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            print("[SUCCESS] .env 파일 업데이트 완료")

def print_setup_instructions():
    """설치 안내 출력"""
    print("\n=== 설정 방법 ===")
    print("\n[Firebase 설정]")
    print("1. Firebase Console 접속: https://console.firebase.google.com/")
    print("2. 프로젝트 생성 및 Authentication 활성화")
    print("3. 서비스 계정 키 다운로드 (firebase-adminsdk-key.json)")
    print("4. 프로젝트 루트 디렉토리에 파일 배치")
    print("5. 이 스크립트 다시 실행")
    
    print("\n[GitHub OAuth 설정]")
    print("1. GitHub OAuth Apps: https://github.com/settings/developers")
    print("2. New OAuth App 생성")
    print("3. Client ID와 Client Secret 획득")
    print("4. .env 파일에 설정:")
    print("   GITHUB_ENABLED=true")
    print("   GITHUB_CLIENT_ID=your_client_id")
    print("   GITHUB_CLIENT_SECRET=your_client_secret")
    print("5. 이 스크립트 다시 실행")

if __name__ == '__main__':
    print("=== Engineering Shorts Generator 빠른 설정 ===\n")
    
    auto_detect_settings()
    print_setup_instructions()