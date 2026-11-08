# GitHub & Vercel 배포 가이드

## 출시 준비 상태
- ✅ GitHub 저장소 `paddockapp-hub/tech-video-ai`에 연결되어 있습니다.
- ✅ 저장소에 root Flask entrypoint와 Vercel Python 설정이 있습니다.
- ✅ Vercel 배포에서 영상, SRT, 캡션 모두 Blob에 저장되도록 fail-closed 설정되어 있습니다.
- ⚠️ Vercel 프로젝트, Blob 저장소, Google 이미지 생성 자격 증명은 계정 소유자가 연결해야 합니다.
- ⚠️ 현재 로컬 점검에서 Google 이미지 서비스 인증이 거부됩니다. 이때는 실제 생성 이미지가 아니라 명시적인 로컬 도식 폴백이 사용됩니다.
- ⚠️ 정식 공개 전 사용자별 인증을 연결해야 합니다. 현재 API 토큰 입력은 제한된 Preview/내부 테스트용입니다. 공유 `AUTH_TOKEN`을 공개 웹사이트에 배포하지 마세요.

## 🚀 Vercel 배포 방법

### 방법 1: Vercel Dashboard에서 직접 배포

#### 1단계: Vercel 프로젝트 생성
1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "Add New Project" 클릭
3. GitHub 저장소 선택
4. "Import" 클릭

#### 2단계: 프로젝트 설정
```
Project Name: engineering-shorts-generator
Framework Preset: Auto-detect (Python/Flask)
Root Directory: ./
Build Command: (비워둠; Python runtime detects app.py)
Output Directory: (비워둠)
```
`app.py` is the supported Flask entrypoint and exports the initialized WSGI
application. `.python-version` pins the deployment to Python 3.12. The Flask
function is allowed up to 300 seconds for Ollama, TTS, and video encoding.
Do not add a custom Build Command or legacy `builds`/`routes` configuration;
Vercel detects the Python app and routes requests to Flask.

#### 3단계: 환경 변수 설정
Vercel Dashboard → Settings → Environment Variables:

```env
OLLAMA_BASE_URL_14=https://<assigned-host>.trycloudflare.com
OLLAMA_MODEL_13=llama3.2:latest
AUTH_TOKEN=<same strong token used by the authenticated local tunnel gateway>
TTS_PROVIDER=gtts
TTS_LANGUAGE=ko-KR
GOOGLE_IMAGE_MODEL=gemini-nano-banana-2.1
BLOB_READ_WRITE_TOKEN=<Vercel Blob read-write token>
```

The Vercel runtime automatically selects Blob storage and requires persistent
artifact storage. These defaults are enforced by the app when Vercel sets
`VERCEL=1`; no deprecated `env` values in `vercel.json` are needed. Set
`BLOB_READ_WRITE_TOKEN` in the Vercel project before generating videos.
Temporary renders are written under `/tmp`; generated artifacts are uploaded
to Blob before the API reports success because serverless files are ephemeral.

`localhost` in a Vercel environment refers to the Vercel runtime itself, not
the developer's computer. For remote Ollama, run the authenticated local
gateway described in [OLLAMA_EXTERNAL_SETUP.md](OLLAMA_EXTERNAL_SETUP.md) and
set its current Quick Tunnel URL as `OLLAMA_BASE_URL_14`. The tunnel host
and Vercel Preview must share the same `AUTH_TOKEN`. Redeploy Preview after
updating the URL or token. Quick Tunnel URLs change when restarted.
The default, no-key speech engine is `TTS_PROVIDER=gtts` with
`TTS_LANGUAGE=ko-KR`. It generates real speech through the online gTTS service
and requires network access. If that provider is unavailable, the final
fallback is a synthetic tone, explicitly marked as `synthetic-fallback` rather
than spoken narration. To use ElevenLabs instead, set both `TTS_API_KEY` and
`TTS_VOICE` as encrypted Vercel Preview environment variables and choose
`TTS_PROVIDER=elevenlabs`; gTTS remains the real-speech fallback if ElevenLabs
fails. Do not put the key in Git or application logs.

Gemini image generation uses `GOOGLE_API_KEY` and the configured
`GOOGLE_IMAGE_MODEL` through the Gemini image-generation API. If the key is
missing, invalid, or the model is unavailable, the app renders a local
engineering diagram and reports `image_source=local-renderer`; it does not
represent that diagram as an external AI-generated image.

After setting the same Preview values in a secure local environment, run
`python -m scripts.verify_remote_services`. It prints only sanitized service
statuses, checks that `/api/tags` is HTTP 200 JSON with the configured model,
checks the configured Gemini image model when an API key is present, and
verifies that the selected ElevenLabs provider has the configured voice or
that the default gTTS provider can generate real speech. With the default
`TTS_PROVIDER=gtts`, ElevenLabs credentials are not required. On the Windows Ollama host,
`.\scripts\start-preview-tunnel.ps1` starts the tunnel and copies the Preview
variable block to the clipboard. When both ElevenLabs settings already exist
locally it uses ElevenLabs; otherwise it selects gTTS without prompting for
missing credentials. It never prints secret values.

Vercel uses Blob storage for the generated MP4, SRT, and caption because local
function files and in-memory job maps are not durable across serverless requests.
Create a Blob store in the Vercel project and set its read-write token as
`BLOB_READ_WRITE_TOKEN`. `REQUIRE_PERSISTENT_STORAGE=true` makes generation fail
with a sanitized service-unavailable response instead of claiming success when
any artifact could not be persisted. Successful generation returns the durable
Blob URLs directly.

### Stable VPS tunnel with Cloudflare Access

For Production, use a named Cloudflare Tunnel and an Access Service Auth policy
instead of a temporary Quick Tunnel. The VPS should bind Ollama to
`127.0.0.1:11434`, keep port 11434 closed to external traffic, and run both
Ollama and `cloudflared` under restart-enabled systemd services. Follow
[`CLOUDFLARE_VPS_SETUP.md`](CLOUDFLARE_VPS_SETUP.md) for deployable templates
and setup steps.

Set these Vercel variables for **Production**, using the real fixed hostname
and Cloudflare-issued Service Token values:

```env
OLLAMA_BASE_URL=https://ollama.<YOUR_DOMAIN>
OLLAMA_MODEL=llama3.2:latest
CF_ACCESS_CLIENT_ID=<Cloudflare Access service token client ID>
CF_ACCESS_CLIENT_SECRET=<Cloudflare Access service token client secret>
```

The application sends the Access headers only over HTTPS to the exact hostname
configured in `OLLAMA_BASE_URL`. Keep both token variables encrypted and never
paste their values into source control, chat, or logs. Redeploy Production
after updating them.

#### 4단계: 배포
- "Deploy" 버튼 클릭
- 배포 완료까지 기다림

### 방법 2: Vercel CLI 사용

#### 1단계: Vercel CLI 설치
```bash
npm install -g vercel
```

#### 2단계: 로그인
```bash
vercel login
```

#### 3단계: 프로젝트 배포
```bash
cd engineering-shorts-generator
vercel
```

#### 4단계: 환경 변수 설정
```bash
vercel env add USE_LOCAL_AI
vercel env add OLLAMA_HOST
vercel env add OLLAMA_MODEL
vercel env add STORAGE_TYPE
```

## 🔧 프로젝트 구조 최적화

### 필요한 파일만 유지
```
engineering-shorts-generator/
├── src/                          # 소스 코드
│   ├── __init__.py
│   ├── auth_service.py           # 인증 서비스
│   ├── storage_service.py        # 스토리지 서비스
│   ├── web_server.py             # 웹 서버
│   ├── integrated_main.py        # 통합 메인
│   ├── local_main.py             # 기본 메인
│   ├── script_analyzer.py        # 스크립트 분석
│   ├── ollama_service.py         # 로컬 GPT
│   ├── google_flow_service.py    # 이미지 생성
│   ├── image_workflow.py         # 이미지 워크플로우
│   ├── video_editor.py           # 비디오 편집
│   ├── tts_service.py            # TTS 서비스
│   ├── keyframe_manager.py       # 키프레임 관리
│   ├── gpt_service.py            # GPT 서비스
│   └── stable_diffusion_service.py
├── requirements.txt              # Python 의존성
├── vercel.json                   # Vercel 설정
├── .env.example                  # 환경 변수 예제
├── .gitignore                    # Git 무시 파일
├── README.md                     # 메인 README
├── QUICK_START.md                # 빠른 시작 가이드
├── FIREBASE_SETUP_GUIDE.md       # Firebase 설정 가이드
├── GITHUB_OAUTH_SETUP_GUIDE.md   # GitHub OAuth 설정 가이드
├── INSTALL_AUTH.md               # 인증 설치 가이드
├── V0_INTEGRATION_GUIDE.md       # v0 통합 가이드
├── quick_setup.py                # 빠른 설정 스크립트
├── generate_v0_content.py       # v0 콘텐츠 생성기
└── example_script.md            # 예제 스크립트
```

### 제외해야 할 파일
```
❌ venv/                    # 가상 환경
❌ output/                   # 출력 파일
❌ temp/                    # 임시 파일
❌ uploads/                 # 업로드 파일
❌ stable-diffusion-webui/  # Stable Diffusion (별도로 관리)
❌ test_*.py               # 테스트 파일
❌ test_*.txt              # 테스트 파일
❌ *.pyc                   # Python 캐시
❌ __pycache__/             # Python 캐시 디렉토리
❌ .env                     # 환경 변수 (보안)
❌ firebase-adminsdk-key.json  # Firebase 키 (보안)
```

## 🚀 배포 후 설정

### 1. Firebase 연동 (선택사항)
Vercel Dashboard → Settings → Environment Variables:
```env
FIREBASE_ENABLED=true
FIREBASE_KEY_PATH=firebase-adminsdk-key.json
```

### 2. GitHub OAuth 연동 (선택사항)
Vercel Dashboard → Settings → Environment Variables:
```env
GITHUB_ENABLED=true
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=https://your-app.vercel.app/auth/github/callback
```

### 3. 도메인 설정
Vercel Dashboard → Settings → Domains:
- 기본 도메인: `your-app.vercel.app`
- 커스텀 도메인 추가 가능

## 🎯 배포 확인

### 1. 배포 상태 확인
```bash
vercel ls
```

### 2. 로그 확인
```bash
vercel logs
```

### 3. 배포된 사이트 접속
- 기본 URL: `https://engineering-shorts-generator.vercel.app`
- 또는 커스텀 도메인

## 🔍 문제 해결

### 배포 실패
- Python 버전 확인 (Python 3.12+)
- requirements.txt 확인
- Vercel 로그 확인

### 환경 변수 문제
- Vercel Dashboard에서 환경 변수 확인
- .env.example 파일 참조

### Firebase 연동 문제
- Firebase 키 파일 확인
- 환경 변수 확인
- Firebase Console에서 설정 확인

## 📋 다음 단계

1. GitHub 저장소 생성 및 연결
2. 프로젝트 파일 커밋 및 푸시
3. Vercel 프로젝트 생성
4. 환경 변수 설정
5. 배포 실행
6. Firebase/GitHub OAuth 설정 (선택사항)