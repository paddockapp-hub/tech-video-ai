# 실제 프로덕션 환경 설정 템플릿

## 🎯 외부 접근 가능한 전체 설정

### 1. Ollama 외부 HTTPS 서버 (NGROK)

#### NGROK 설치 및 실행
```bash
# 1. NGROK 설치
choco install ngrok

# 2. NGROK 인증
ngrok authtoken YOUR_NGROK_AUTH_TOKEN

# 3. Ollama 서버 실행
ollama serve

# 4. NGROK 터널링 (새 터미널에서)
ngrok http 11434

# 5. 제공된 HTTPS 주소 복사
# 예: https://abc123.ngrok-free.app
```

#### 환경 변수
```env
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok-free.app
OLLAMA_MODEL=llama3.2
```

### 2. 렌더링 서버 (FFmpeg)

#### FFmpeg 설치
```bash
choco install ffmpeg
```

#### 렌더링 서버 주소
```env
RENDER_SERVER_URL=http://localhost:5001
```

### 3. TTS 서비스

#### Google Cloud TTS
```env
GOOGLE_TTS_ENABLED=true
GOOGLE_CLOUD_TTS_API_KEY=your_google_api_key
```

#### ElevenLabs TTS (대안)
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

### 4. 이미지 생성

#### Google Flow API
```env
GOOGLE_API_KEY=your_google_api_key
```

### 5. 저장소

#### AWS S3
```env
STORAGE_TYPE=s3
S3_BUCKET_NAME=your_bucket_name
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
```

## 🚀 전체 .env 템플릿

```env
# AI 설정
USE_LOCAL_AI=true
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok-free.app
OLLAMA_MODEL=llama3.2

# Google API
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-pro

# TTS 설정
GOOGLE_TTS_ENABLED=true
GOOGLE_CLOUD_TTS_API_KEY=your_google_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# 렌더링 서버
RENDER_SERVER_URL=http://localhost:5001

# 스토리지 설정
STORAGE_TYPE=s3
S3_BUCKET_NAME=your_bucket_name
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# 인증 설정
FIREBASE_ENABLED=false
GITHUB_ENABLED=false
```

## 🔍 연결 테스트

### Ollama 연결 테스트
```bash
curl https://your-ngrok-url.ngrok-free.app/api/tags
```

### 모델 목록 확인
```bash
curl https://your-ngrok-url.ngrok-free.app/api/tags
```

## 📋 v0.dev에서 호출

### Ollama API 호출
```javascript
const OLLAMA_BASE_URL = 'https://your-ngrok-url.ngrok-free.app';

fetch(`${OLLAMA_BASE_URL}/api/generate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.2',
    prompt: '공학 쇼츠 프롬프트 생성'
  })
})
```

## ⚠️ 보안 주의사항

1. **NGROK**: 테스트용만 사용, 5분마다 URL 변경
2. **API 키**: 절대 공개하지 말고 환경 변수만 사용
3. **프로덕션**: 전용 도메인과 SSL 인증서 사용