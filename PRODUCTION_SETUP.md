# 실제 프로덕션 환경 설정 가이드

## 🎯 전체 인프라 구성

### 1. Ollama 외부 HTTPS 서버 (NGROK)
### 2. 렌더링 서버 (FFmpeg/Remotion)
### 3. TTS 서비스 (Google Cloud TTS)
### 4. 이미지 생성 (Google Flow API)
### 5. 저장소 (AWS S3)

## 🚀 1단계: Ollama 외부 HTTPS 서버

### NGROK 설치 및 설정
```bash
# 1. NGROK 설치
choco install ngrok

# 2. NGROK 인증 (https://ngrok.com)
ngrok authtoken YOUR_NGROK_AUTH_TOKEN

# 3. Ollama 서버 실행
ollama serve

# 4. NGROK 터널링 (새 터미널에서)
ngrok http 11434

# 5. 제공된 HTTPS 주소 복사
# 예: https://abc123.ngrok-free.app
```

### 모델 설치 확인
```bash
# 설치된 모델 확인
ollama list

# 필요한 모델 다운로드
ollama pull llama3.2
ollama pull mistral
ollama pull codellama
```

### 환경 변수 설정
```env
# Ollama 외부 접속
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok-free.app
OLLAMA_MODEL=llama3.2

# 인증 (선택사항)
OLLAMA_API_KEY=your_api_key
```

## 🎬 2단계: 렌더링 서버 설정

### FFmpeg 설치
```bash
# Windows용 FFmpeg 다운로드
https://ffmpeg.org/download.html

# 또는 Chocolatey 설치
choco install ffmpeg

# 확인
ffmpeg -version
```

### Remotion 설치 (선택사항)
```bash
# Node.js 프로젝트에서 Remotion 설치
npm install remotion
npm install @remotion/cli
```

### 렌더링 서버 API
```python
# render_server.py
from flask import Flask, request, jsonify
import subprocess
import os

app = Flask(__name__)

@app.route('/render', methods=['POST'])
def render_video():
    data = request.json
    script_file = data.get('script_file')
    
    # FFmpeg로 비디오 렌더링
    cmd = [
        'ffmpeg',
        '-i', script_file,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-c:a', 'aac',
        'output.mp4'
    ]
    
    subprocess.run(cmd)
    
    return jsonify({'success': True, 'output': 'output.mp4'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)
```

## 🔊 3단계: TTS 서비스 설정

### Google Cloud TTS
```env
# Google Cloud TTS 설정
GOOGLE_TTS_ENABLED=true
GOOGLE_CLOUD_TTS_API_KEY=your_google_api_key
GOOGLE_TTS_LANGUAGE=en-US
GOOGLE_TTS_VOICE=en-US-Neural2
```

### ElevenLabs TTS (대안)
```env
# ElevenLabs TTS 설정
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE=your_voice_id
```

## 🎨 4단계: 이미지 생성 설정

### Google Flow API
```env
# Google Flow API 설정
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-pro
```

### DALL-E API (대안)
```env
# OpenAI DALL-E 설정
OPENAI_API_KEY=your_openai_api_key
DALL_E_MODEL=dall-e-3
```

## 💾 5단계: 저장소 설정

### AWS S3
```env
# AWS S3 설정
STORAGE_TYPE=s3
S3_BUCKET_NAME=your_bucket_name
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
```

### Azure Blob Storage (대안)
```env
# Azure Blob Storage 설정
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_CONTAINER_NAME=your_container
```

## 🔧 6단계: 전체 시스템 통합

### 환경 변수 파일 (.env)
```env
# AI 설정
USE_LOCAL_AI=true
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok-free.app
OLLAMA_MODEL=llama3.2

# Google API
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-pro
GOOGLE_TTS_ENABLED=true
GOOGLE_CLOUD_TTS_API_KEY=your_google_api_key

# TTS 설정
ELEVENLABS_API_KEY=your_elevenlabs_api_key

# 스토리지 설정
STORAGE_TYPE=s3
S3_BUCKET_NAME=your_bucket_name
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1

# 렌더링 서버
RENDER_SERVER_URL=http://localhost:5001
```

## 🚀 7단계: 서버 실행

### 서버 실행 스크립트
```bash
# start_all_servers.sh
#!/bin/bash

# 1. Ollama 서버 실행
ollama serve &

# 2. NGROK 터널링
ngrok http 11434 &

# 3. 렌더링 서버 실행
python render_server.py &

# 4. 웹 서버 실행
python src/web_server.py
```

## 📋 API 엔드포인트

### 렌더링 서버
```
POST /render - 비디오 렌더링
GET /status - 렌더링 상태
```

### 웹 서버
```
POST /ollama/generate - Ollama 텍스트 생성
POST /ollama/analyze-script - 스크립트 분석
POST /storage/upload - 파일 업로드
POST /render/start - 비디오 렌더링 시작
```

## 🔍 연결 테스트

### Ollama 연결 테스트
```bash
curl https://your-ngrok-url.ngrok-free.app/api/tags
```

### 렌더링 서버 테스트
```bash
curl http://localhost:5001/status
```

### 전체 시스템 테스트
```bash
python test_full_system.py
```

## 🎯 실제 사용 방법

### v0.dev에서 호출
```javascript
// 1. Ollama 프롬프트 생성
const ollamaResponse = await fetch('https://your-ngrok-url.ngrok-free.app/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama3.2',
    prompt: '공학 쇼츠 프롬프트 생성'
  })
});

// 2. 렌더링 요청
const renderResponse = await fetch('http://your-render-server:5001/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    script_file: 'script.json'
  })
});
```

## ⚠️ 보안 주의사항

1. **NGROK**: 테스트용만 사용, 프로덕션은 전용 도메인
2. **API 키**: 환경 변수로만 저장, 코드에 직접 입력 금지
3. **방화벽**: 최소한 포트만 개방, IP 필터링 적용
4. **인증**: 모든 API에 인증 토큰 사용

## 📊 추천 구성

**테스트용**: NGROK + 로컬 FFmpeg + Google TTS + S3
**프로덕션용**: 전용 도메인 + 전용 렌더링 서버 + ElevenLabs TTS + S3