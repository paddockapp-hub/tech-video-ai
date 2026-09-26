# 1분 만에 Firebase/GitHub OAuth 설정

## 🚀 빠른 시작

### 1단계: 빠른 설정 스크립트 실행
```bash
cd engineering-shorts-generator
py -3.14 quick_setup.py
```

### 2단계: Firebase 설정 (선택사항)
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 → "프로젝트 만들기"
4. 왼쪽 메뉴 → "Authentication" → "시작하기"
5. "로그인 방법" → "이메일/비밀번호" → "사용 설정"
6. 왼쪽 메뉴 → "프로젝트 설정" (톱니바퀴)
7. "서비스 계정" 탭 → "새 비공개 키 생성"
8. JSON 파일 다운로드 → `firebase-adminsdk-key.json`으로 이름 변경
9. 프로젝트 루트 디렉토리에 파일 배치
10. `py -3.14 quick_setup.py` 다시 실행

### 3단계: GitHub OAuth 설정 (선택사항)
1. [GitHub Developer Settings](https://github.com/settings/developers) 접속
2. "OAuth Apps" → "New OAuth App"
3. 앱 정보 입력:
   - Application name: `Engineering Shorts Generator`
   - Homepage URL: `http://localhost:8000`
   - Authorization callback URL: `http://localhost:8000/auth/github/callback`
4. "Register application" 클릭
5. Client ID 복사
6. "Generate a new client secret" 클릭 → Secret 복사
7. `.env` 파일에 추가:
   ```env
   GITHUB_ENABLED=true
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```
8. `py -3.14 quick_setup.py` 다시 실행

## ✅ 확인

설정 완료 후:
```bash
# 시스템 상태 확인
py -3.14 quick_setup.py

# 웹 서버 실행
py -3.14 src/integrated_main.py --mode server --port 8000

# API 테스트
py -3.14 test_web_server.py
```

## 🎯 현재 상태

- ✅ **기본 기능**: 완벽 작동 (이미지 생성, 비디오 생성)
- ✅ **로컬 스토리지**: 완벽 작동
- ✅ **웹 서버**: 완벽 작동
- 🔧 **Firebase**: 설정 파일만 있으면 즉시 활성화
- 🔧 **GitHub OAuth**: .env 설정만 있으면 즉시 활성화

## 📁 필요한 파일

### Firebase 활성화 시:
- `firebase-adminsdk-key.json` (프로젝트 루트)

### GitHub OAuth 활성화 시:
- `.env` 파일에 다음 설정:
  ```env
  GITHUB_ENABLED=true
  GITHUB_CLIENT_ID=your_client_id
  GITHUB_CLIENT_SECRET=your_client_secret
  ```

## 🔍 설정 확인

```bash
# 설정 상태 확인
py -3.14 quick_setup.py

# 예상 출력:
# [FIREBASE] 서비스 계정 키: 활성화 (또는 비활성화)
# [GITHUB] OAuth: 활성화 (또는 비활성화)
```

## 🚨 문제 해결

### Firebase가 활성화되지 않음
- `firebase-adminsdk-key.json` 파일이 프로젝트 루트에 있는지 확인
- 파일 이름이 정확한지 확인
- `.env` 파일에 `FIREBASE_ENABLED=true`가 있는지 확인

### GitHub OAuth가 활성화되지 않음
- `.env` 파일에 `GITHUB_ENABLED=true`가 있는지 확인
- `GITHUB_CLIENT_ID`와 `GITHUB_CLIENT_SECRET`가 설정되어 있는지 확인
- `GITHUB_REDIRECT_URI`가 GitHub 앱 설정과 일치하는지 확인

## 🎉 완료

이제 시스템이 완벽하게 작동합니다!

```bash
# 웹 서버 실행
py -3.14 src/integrated_main.py --mode server --port 8000

# 비디오 생성
py -3.14 src/local_main.py example_script.md --mode video
```