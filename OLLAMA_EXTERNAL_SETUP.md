# Ollama 외부 서버 연결 가이드

## 🎯 외부 Ollama 서버 설정 방법

### 방법 1: NGROK 사용 (가장 쉬움)

#### 1단계: NGROK 설치
```bash
# NGROK 다운로드
https://ngrok.com/download

# 또는 Chocolatey로 설치
choco install ngrok
```

#### 2단계: NGROK 인증
```bash
ngrok authtoken YOUR_NGROK_AUTH_TOKEN
```

#### 3단계: Ollama 서버 실행
```bash
ollama serve
```

#### 4단계: NGROK 터널링
```bash
ngrok http 11434
```

#### 5단계: 외부 HTTPS 주소 획득
NGROK가 다음과 같은 주소를 제공:
```
https://abc123.ngrok-free.app
```

#### 6단계: OLLAMA_BASE_URL 설정
```env
OLLAMA_BASE_URL=https://abc123.ngrok-free.app
OLLAMA_MODEL=llama3.2
```

### 방법 2: 로컬 네트워크 공유 (단순)

#### 1단계: 로컬 IP 확인
```bash
ipconfig
# IPv4 주소 확인: 192.168.1.XXX
```

#### 2단계: Ollama 서버 실행
```bash
# 모든 네트워크 인터페이스에서 접근 허용
OLLAMA_HOST=0.0.0.0 ollama serve
```

#### 3단계: 방화벽 설정
- 포트 11434 허용
- 로컬 IP 공유

#### 4단계: OLLAMA_BASE_URL 설정
```env
OLLAMA_BASE_URL=http://192.168.1.XXX:11434
OLLAMA_MODEL=llama3.2
```

### 방법 3: 클라우드 서버 배포 (전문)

#### 1단계: 클라우드 서버 선택
- AWS EC2
- Google Cloud Platform
- Azure Virtual Machine
- DigitalOcean

#### 2단계: 서버 설정
```bash
# Ubuntu/Debian 서버에서
curl -fsSL https://ollama.com/install.sh | sh

# 또는 수동 설치
curl https://ollama.com/ollama-linux-amd64 -o ollama
chmod +x ollama
sudo mv ollama /usr/local/bin/
```

#### 3단계: Ollama 서버 실행
```bash
ollama serve
```

#### 4단계: SSL 인증서 설정
```bash
# Let's Encrypt 사용
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.com
```

#### 5단계: 방화벽 설정
```bash
sudo ufw allow 11434/tcp
```

#### 6단계: OLLAMA_BASE_URL 설정
```env
OLLAMA_BASE_URL=https://your-domain.com:11434
OLLAMA_MODEL=llama3.2
```

### 🔐 인증 방식

#### 방법 1: API Key 인증
```python
# 웹 서버에 API Key 추가
import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY'
}

response = requests.post(
    f"{OLLAMA_BASE_URL}/api/generate",
    headers=headers,
    json={
        'model': 'llama3.2',
        'prompt': prompt
    }
)
```

#### 방법 2: IP 허용 (단순)
```python
# 웹 서버에서 IP 허용 설정
ALLOWED_IPS = ['your-ip-address', 'another-ip']

def is_ip_allowed(client_ip):
    return client_ip in ALLOWED_IPS
```

#### 방법 3: Nginx 프록시 (전문)
```nginx
location /api/ {
    proxy_pass http://localhost:11434;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    
    # 인증
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

## 🚀 추천 방법: NGROK

### 빠른 설정
```bash
# 1. NGROK 설치
choco install ngrok

# 2. Ollama 서버 실행
ollama serve

# 3. NGROK 터널링 (새 터미널)
ngrok http 11434

# 4. 제공된 HTTPS 주소 복사
# 예: https://abc123.ngrok-free.app

# 5. 환경 변수 설정
OLLAMA_BASE_URL=https://abc123.ngrok-free.app
```

## 📋 현재 설정

### 추천 OLLAMA_BASE_URL 값
```env
# NGROK 사용 (추천)
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok-free.app

# 또는 로컬 IP (단순)
OLLAMA_BASE_URL=http://192.168.1.XXX:11434

# 또는 클라우드 서버 (전문)
OLLAMA_BASE_URL=https://your-domain.com:11434
```

## ⚠️ 보안 주의사항

1. **NGROK 무료 플랜**: 
   - 임시 URL (재시작 시 변경)
   - 트래픽 제한
   - 테스트용으로 적합

2. **프로덕션용**:
   - 전용 도메인 사용
   - SSL 인증서 설치
   - API Key 인증 필수
   - 속도 제한 설정

3. **방화벽**:
   - 최소한의 포트만 개방
   - IP 필터링 적용
   - 속도 제한 설정

## 🎯 v0.dev에 적용

### API 호출 수정
```javascript
// OLLAMA_BASE_URL 사용
const OLLAMA_BASE_URL = 'https://your-ngrok-url.ngrok-free.app';

fetch(`${OLLAMA_BASE_URL}/api/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'llama3.2',
    prompt: prompt
  })
})
```

### 환경 변수 설정
```env
# v0.dev 프로젝트 설정
OLLAMA_BASE_URL=https://your-ngrok-url.ngrok-free.app
OLLAMA_MODEL=llama3.2
```

## 📊 요약

**가장 쉬운 방법**: NGROK
- 설치: `choco install ngrok`
- 실행: `ngrok http 11434`
- 주소: `https://abc123.ngrok-free.app`
- OLLAMA_BASE_URL: `https://abc123.ngrok-free.app`

**전문 방법**: 클라우드 서버
- 서버: AWS/GCP/Azure
- SSL: Let's Encrypt
- 인증: API Key 또는 IP 필터링
- OLLAMA_BASE_URL: `https://your-domain.com:11434`