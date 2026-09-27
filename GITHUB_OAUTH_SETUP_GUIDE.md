# GitHub OAuth 실제 설정 가이드

## 1. GitHub OAuth 앱 생성

### 1.1 GitHub Developer Settings 접근
1. GitHub에 로그인
2. 우측 상단 프로필 클릭 → "Settings"
3. 왼쪽 메뉴에서 "Developer settings" 클릭
4. "OAuth Apps" 클릭

### 1.2 새 OAuth 앱 생성
1. "New OAuth App" 버튼 클릭
2. 앱 정보 입력:
   - **Application name**: `Engineering Shorts Generator`
   - **Homepage URL**: `http://localhost:8000` (로컬 개발용)
   - **Application description**: `공학 쇼츠 자동 생성 시스템`
   - **Authorization callback URL**: `http://localhost:8000/auth/github/callback`
3. "Register application" 클릭

### 1.3 Client ID 및 Secret 확인
1. 앱 생성 후 다음 정보를 복사:
   - **Client ID**: 앱 페이지 상단에 표시
   - **Client Secret**: "Generate a new client secret" 버튼 클릭 후 생성

## 2. .env 파일 설정

프로젝트 루트의 `.env` 파일에 다음 내용 추가:

```env
# GitHub OAuth 설정
GITHUB_ENABLED=true
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
```

### 2.1 값 설명
- `GITHUB_ENABLED`: GitHub OAuth 활성화 여부 (true/false)
- `GITHUB_CLIENT_ID`: GitHub에서 받은 Client ID
- `GITHUB_CLIENT_SECRET`: GitHub에서 받은 Client Secret
- `GITHUB_REDIRECT_URI`: OAuth 콜백 URL (GitHub 앱 설정과 일치해야 함)

## 3. 로컬 개발 환경 설정

### 3.1 포트 설정
기본 포트는 8000입니다. 다른 포트를 사용하려면:

1. GitHub OAuth 앱 설정에서 Authorization callback URL 변경
2. `.env` 파일에서 `GITHUB_REDIRECT_URI` 변경
3. 웹 서버 실행 시 포트 지정:
   ```bash
   py -3.14 src/integrated_main.py --mode server --port 3000
   ```

### 3.2 HTTPS (프로덕션용)
프로덕션 환경에서는 HTTPS가 필요합니다:
- HTTPS URL 사용
- GitHub OAuth 앱 설정에서 callback URL을 HTTPS로 변경
- Vercel 또는 다른 HTTPS 지원 플랫폼 사용

## 4. GitHub OAuth 연동 테스트

### 4.1 연동 테스트 스크립트 실행
```bash
cd engineering-shorts-generator
py -3.14 test_auth_storage.py
```

### 4.2 예상 결과
- GitHub OAuth 상태: 활성화
- GitHub 인증 URL 생성 성공

### 4.3 웹 서버에서 테스트
```bash
# 웹 서버 시작
py -3.14 src/integrated_main.py --mode server

# 별도 터미널에서 GitHub 인증 URL 테스트
py -3.14 test_web_server.py
```

## 5. 실제 GitHub 로그인 테스트

### 5.1 웹 서버 시작
```bash
py -3.14 src/integrated_main.py --mode server --host 127.0.0.1 --port 8000
```

### 5.2 브라우저에서 테스트
1. 브라우저에서 `http://127.0.0.1:8000/auth/github` 접속
2. GitHub 로그인 페이지로 리디렉션
3. 로그인 및 권한 부여
4. `/auth/github/callback`으로 리디렉션 및 사용자 정보 반환

### 5.3 API 테스트
```python
import requests

# GitHub 인증 URL 가져오기
response = requests.get("http://127.0.0.1:8000/auth/github")
print(response.json())

# 결과: {"success": true, "auth_url": "https://github.com/login/oauth/authorize?..."}
```

## 6. GitHub OAuth 권한 설정

### 6.1 필요한 권한
- `user:email`: 사용자 이메일 접근
- `user:profile`: 사용자 프로필 정보 접근

### 6.2 권한 변경 (필요한 경우)
1. GitHub OAuth 앱 설정 페이지 접근
2. "Application settings" 탭
3. "Authorization callback URL" 확인
4. 권한 범위가 필요한 경우 앱 재설정

## 7. 문제 해결

### 7.1 리디렉션 URI 불일치
- **문제**: "redirect_uri_mismatch" 오류
- **해결**:
  - GitHub OAuth 앱 설정의 callback URL과 `.env`의 `GITHUB_REDIRECT_URI`가 일치하는지 확인
  - 포트 번호가 일치하는지 확인
  - HTTP vs HTTPS 확인

### 7.2 Client Secret 오류
- **문제**: "Bad client credentials" 오류
- **해결**:
  - `.env` 파일의 `GITHUB_CLIENT_SECRET`이 올바른지 확인
  - GitHub에서 Client Secret을 재생성하고 업데이트

### 7.3 네트워크 문제
- **문제**: 연결 시간 초과
- **해결**:
  - 인터넷 연결 확인
  - 방화벽 설정 확인
  - 프록시 설정 확인

### 7.4 CORS 오류
- **문제**: CORS 관련 오류
- **해결**:
  - 웹 서버에 CORS 헤더 추가
  - 프론트엔드와 백엔드 도메인 확인

## 8. 보안 고려사항

### 8.1 Client Secret 보호
- **중요**: Client Secret을 절대 공개하지 않음
- `.env` 파일을 `.gitignore`에 추가
- 환경 변수 또는 비밀 관리 서비스 사용

### 8.2 HTTPS 사용
- 로컬 개발: HTTP 허용
- 프로덕션: HTTPS 필수
- Vercel 배포 시 자동 HTTPS 제공

### 8.3 토큰 관리
- GitHub 액세스 토큰 안전하게 저장
- 토큰 만료 시간 설정
- 토큰 갱신 로직 구현

## 9. 프로덕션 배포 설정

### 9.1 Vercel 배포용 설정
Vercel 배포 시 `.env` 변수를 Vercel Dashboard에 설정:

```env
GITHUB_ENABLED=true
GITHUB_CLIENT_ID=your_production_client_id
GITHUB_CLIENT_SECRET=your_production_client_secret
GITHUB_REDIRECT_URI=https://your-vercel-app.vercel.app/auth/github/callback
```

### 9.2 도메인 설정
- Vercel 도메인 사용: `https://your-app.vercel.app`
- 커스텀 도메인 사용: `https://your-domain.com`
- GitHub OAuth 앱 callback URL을 프로덕션 도메인으로 변경

## 10. 다중 OAuth 제공업체

### 10.1 Firebase Google OAuth와 함께 사용
Firebase Google OAuth와 GitHub OAuth를 동시에 사용할 수 있습니다:

```env
# Firebase 설정
FIREBASE_ENABLED=true
FIREBASE_KEY_PATH=firebase-adminsdk-key.json

# GitHub OAuth 설정
GITHUB_ENABLED=true
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
```

### 10.2 사용자 경험
- 로그인 페이지에서 여러 로그인 옵션 제공
- 사용자가 원하는 OAuth 제공업체 선택
- 각 제공업체별 사용자 ID 통합

## 11. 다음 단계

GitHub OAuth 설정이 완료되면:
1. 전체 인증 시스템 통합 테스트
2. 다중 OAuth 제공업체 테스트
3. Vercel 배포
4. 프로덕션 환경에서 테스트