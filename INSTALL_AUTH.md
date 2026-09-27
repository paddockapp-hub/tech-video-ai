# 인증 및 스토리지 시스템 설치 가이드

## 개요
이 시스템은 Firebase, GitHub OAuth, AWS S3, Vercel 등 다양한 인증 및 스토리지 서비스를 지원합니다.

## 추가 패키지 설치

인증 및 스토리지 기능을 사용하려면 다음 패키지들을 설치해야 합니다:

```bash
pip install firebase-admin requests-oauthlib boto3 google-cloud-storage flask
```

또는 requirements.txt를 업데이트하고 설치:

```bash
pip install -r requirements.txt
```

## Firebase 설정

### 1. Firebase 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 새 프로젝트 생성
3. Authentication 활성화 (Email/Password, Google 제공업체)

### 2. 서비스 계정 키 생성
1. Firebase Console → 프로젝트 설정 → 서비스 계정
2. "새 비공개 키 생성" 클릭
3. JSON 파일 다운로드 후 프로젝트 루트에 저장 (예: `firebase-adminsdk-key.json`)

### 3. 환경 변수 설정 (.env)
```env
FIREBASE_ENABLED=true
FIREBASE_KEY_PATH=firebase-adminsdk-key.json
```

## GitHub OAuth 설정

### 1. GitHub OAuth 앱 생성
1. GitHub → Settings → Developer settings → OAuth Apps
2. "New OAuth App" 클릭
3. 앱 정보 입력:
   - Application name: Engineering Shorts Generator
   - Homepage URL: http://localhost:8000
   - Authorization callback URL: http://localhost:8000/auth/github/callback

### 2. 환경 변수 설정 (.env)
```env
GITHUB_ENABLED=true
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback
```

## AWS S3 설정 (선택사항)

### 1. AWS 계정 및 S3 버킷 생성
1. AWS Console 접속
2. S3 서비스에서 새 버킷 생성
3. IAM에서 S3 접근 권한이 있는 사용자 생성 및 액세스 키 발급

### 2. 환경 변수 설정 (.env)
```env
STORAGE_TYPE=s3
S3_BUCKET_NAME=your_s3_bucket_name
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
```

## Vercel 배포

### 1. Vercel CLI 설치
```bash
npm install -g vercel
```

### 2. 프로젝트 배포
```bash
vercel
```

### 3. 환경 변수 설정 (Vercel Dashboard)
Vercel Dashboard → 프로젝트 → Settings → Environment Variables 에서 설정:
- USE_LOCAL_AI=true
- OLLAMA_HOST=http://localhost:11434
- OLLAMA_MODEL=llama3.2
- STORAGE_TYPE=local

## 웹 서버 실행

### 로컬 개발 서버
```bash
python src/integrated_main.py --mode server --host 0.0.0.0 --port 8000
```

### 사용 가능한 API 엔드포인트

#### 인증
- `POST /auth/register` - 사용자 등록
- `POST /auth/login` - 사용자 로그인
- `GET /auth/github` - GitHub 인증 URL
- `GET /auth/github/callback` - GitHub OAuth 콜백
- `POST /auth/verify` - 토큰 검증
- `POST /auth/logout` - 로그아웃

#### 스토리지
- `POST /storage/upload` - 파일 업로드
- `POST /storage/project/<project_id>` - 프로젝트 파일 업로드
- `GET /storage/file/<path>` - 파일 정보 조회
- `DELETE /storage/file/<path>` - 파일 삭제

#### 헬스 체크
- `GET /health` - 서버 상태 확인

## 사용 예시

### 1. 사용자 등록
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "metadata": {"display_name": "Test User"}}'
```

### 2. 파일 업로드
```bash
curl -X POST http://localhost:8000/storage/upload \
  -F "file=@/path/to/file.mp4" \
  -F "destination=videos/test.mp4" \
  -F 'metadata={"user_id": "user123", "type": "video"}'
```

### 3. 인증된 비디오 생성
```python
from integrated_main import IntegratedSystem

system = IntegratedSystem()
result = system.generate_authenticated_video(
    script_file_path="example_script.md",
    user_id="user123"
)
```

## 스토리지 옵션

### 로컬 스토리지 (기본)
```env
STORAGE_TYPE=local
LOCAL_STORAGE_DIR=uploads
```

### Firebase Storage
```env
STORAGE_TYPE=firebase
FIREBASE_ENABLED=true
FIREBASE_KEY_PATH=firebase-adminsdk-key.json
```

### AWS S3
```env
STORAGE_TYPE=s3
S3_BUCKET_NAME=your_bucket_name
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
```

## 보안 주의사항

1. **환경 변수 보호**: .env 파일을 .gitignore에 추가하여 비밀 정보가 노출되지 않도록 하세요
2. **API 키 관리**: API 키와 비밀 키를 코드에 직접 포함하지 마세요
3. **HTTPS 사용**: 프로덕션 환경에서는 HTTPS를 사용하세요
4. **토큰 만료**: 적절한 토큰 만료 시간을 설정하세요
5. **파일 검증**: 업로드된 파일의 형식과 크기를 검증하세요

## 문제 해결

### Firebase 연결 실패
- Firebase SDK가 설치되어 있는지 확인: `pip show firebase-admin`
- 서비스 계정 키 파일 경로가 올바른지 확인
- Firebase 프로젝트에서 Authentication이 활성화되어 있는지 확인

### GitHub OAuth 실패
- GitHub OAuth 앱 설정이 올바른지 확인
- 리디렉션 URI가 일치하는지 확인
- Client ID와 Secret이 올바른지 확인

### S3 업로드 실패
- AWS 자격 증명이 올바른지 확인
- 버킷 이름이 올바른지 확인
- IAM 권한이 S3에 대한 액세스를 허용하는지 확인

### Flask 오류
- Flask가 설치되어 있는지 확인: `pip show flask`
- 웹 서버 모드에서만 Flask가 필요합니다 (비디오/이미지 생성 모드에서는 선택사항)