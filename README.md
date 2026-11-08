# Engineering Shorts Generator

공학 쇼츠 자동 생성 시스템 - Ollama 장면 분석, 음성, 자막 및 세로형 MP4

## 🚀 시스템 개요

이 시스템은 공학 원리를 설명하는 짧은 영상(쇼츠)을 자동으로 생성합니다:

1. **스크립트 분석**: 마크다운 스크립트 분석 및 키프레임 계산
2. **장면 분석**: 연결된 Ollama에서 장면별 구조화 프롬프트 생성
3. **이미지**: 설정된 Gemini 이미지 서비스 사용; 인증/가용성 문제 시 출처를 표시한 주제별 로컬 도식 사용
4. **비디오 편집**: 세로형 MP4, 장면별 2.5D 패럴랙스/줌, 번인 자막, TTS 오디오를 합성
5. **인증 시스템**: Firebase, GitHub OAuth 지원
6. **스토리지**: Firebase Storage, AWS S3, 로컬 스토리지 지원
7. **웹 서버**: REST API 서버 제공

## 📋 요구사항

- Python 3.12+
- Ollama endpoint and installed model (optional; scene-specific local fallback remains available)
- Google image API credentials (optional; local diagram fallback is explicitly labeled)
- FFmpeg (bundled with `imageio-ffmpeg` where available)

## 🛠️ 설치

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. Ollama 설치 및 실행
```bash
# Ollama 설치 (https://ollama.ai)
# 모델 다운로드
ollama pull llama3.2:latest

# Ollama 서버 실행
ollama serve
```

### 3. 환경 설정
`.env` 파일 설정:
```bash
# 로컬 AI 설정
USE_LOCAL_AI=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:latest

# Google API 설정
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_MODEL=gemini-pro

# 비디오 설정
VIDEO_DURATION=30
FPS=30
IMAGE_WIDTH=1080
IMAGE_HEIGHT=1920

# gTTS is the default no-key online Korean speech provider.
TTS_PROVIDER=gtts
TTS_LANGUAGE=ko-KR

# Optional: enable ElevenLabs only when you have a valid key and voice ID.
# TTS_PROVIDER=elevenlabs
# TTS_API_KEY=your_elevenlabs_api_key
# TTS_VOICE=your_elevenlabs_voice_id
```

For remote Preview access to a local Ollama instance, use the authenticated
[Cloudflare tunnel setup](OLLAMA_EXTERNAL_SETUP.md). For stable VPS hosting
with Cloudflare Access, see
[CLOUDFLARE_VPS_SETUP.md](CLOUDFLARE_VPS_SETUP.md). Do not expose port 11434
directly.
On Windows, the one-command setup is `.\scripts\start-preview-tunnel.ps1`.
It copies the Preview variables to the clipboard when the tunnel is ready;
after redeploying Preview, verify with `python -m scripts.verify_remote_services`.
Vercel deployments require a Blob store and `BLOB_READ_WRITE_TOKEN`; the
deployment is configured to return a service-unavailable error rather than
claiming a video is ready when the MP4, subtitles, or caption cannot be
persisted. See [GITHUB_VERCEL_DEPLOYMENT.md](GITHUB_VERCEL_DEPLOYMENT.md).

If ElevenLabs rejects a request or is unavailable, the generator may use gTTS
as an explicitly marked fallback. If gTTS is also unavailable, it may create a
synthetic tone so the pipeline can continue; that output is marked
`synthetic-fallback` and is not spoken narration. Results include the provider
and a non-sensitive error code, never credentials or provider response bodies.

## 🎯 사용법

### 기본 모드

#### 이미지 생성 모드
```bash
python src/local_main.py example_script.md --mode images
```

#### 전체 비디오 생성 모드
```bash
python src/local_main.py example_script.md --mode video
```

### 통합 시스템 모드 (인증/스토리지 포함)

#### 이미지 생성
```bash
python src/integrated_main.py --mode images --script example_script.md
```

#### 비디오 생성
```bash
python src/integrated_main.py --mode video --script example_script.md
```

#### 웹 서버 모드
```bash
python src/integrated_main.py --mode server --host 0.0.0.0 --port 8000
```
서버가 시작되면 브라우저에서 `http://localhost:8000/`을 열고 `AUTH_TOKEN`을 입력해
영상 생성을 요청할 수 있습니다. 서버 프로세스 자체는 인터넷이 필요한 Ollama 터널,
gTTS 및 설정된 저장소에 접근할 수 있어야 합니다.

### 인증된 비디오 생성
```python
from integrated_main import IntegratedSystem

system = IntegratedSystem()
result = system.generate_authenticated_video(
    script_file_path="example_script.md",
    id_token="<Firebase ID token from the signed-in client>"
)
```

## 📁 프로젝트 구조

```
engineering-shorts-generator/
├── src/
│   ├── local_main.py           # 기본 메인 실행 파일
│   ├── integrated_main.py      # 통합 시스템 메인 (인증/스토리지 포함)
│   ├── script_analyzer.py      # 스크립트 분석
│   ├── ollama_service.py       # 로컬 GPT 서비스
│   ├── google_flow_service.py  # 이미지 생성 서비스
│   ├── keyframe_manager.py     # 키프레임 관리
│   ├── image_workflow.py       # 이미지 생성 워크플로우
│   ├── video_editor.py         # 비디오 편집
│   ├── tts_service.py          # 텍스트 음성 변환
│   ├── auth_service.py         # 인증 서비스 (Firebase, GitHub)
│   ├── storage_service.py      # 스토리지 서비스 (Firebase, S3, 로컬)
│   └── web_server.py           # 웹 서버 (Flask API)
├── example_script.md           # 예제 스크립트
├── requirements.txt            # Python 의존성
├── app.py                      # Vercel Flask entrypoint
├── .python-version             # Vercel Python runtime version
├── .env                        # 환경 설정
├── .env.example                # 환경 설정 예제
├── vercel.json                 # Vercel 배포 설정
├── INSTALL_AUTH.md             # 인증/스토리지 설치 가이드
└── README.md                   # 이 파일
```

## 🔧 작동 방식

### 1. 스크립트 분석
- 마크다운 형식의 스크립트 파싱
- 음성 길이 기반 키프레임 계산
- 장면 세분화

### 2. 로컬 GPT 프롬프트 생성
- Ollama (Llama3.2)로 공학 시각화 프롬프트 생성
- 각 장면별 전문 공학 시각화 프롬프트 생성
- 기본 이미지 및 인포그래픽 프롬프트 생성

### 3. 이미지 생성
- Google Flow API로 고품질 공학 시각화 이미지 생성
- 기본 이미지 + 인포그래픽 버전 생성
- 일관된 스타일 유지

### 4. 비디오 생성 (옵션)
- 키프레임 기비디오 조립
- TTS 음성 추가
- 전문 편집 효과 적용

## 🎨 예제 스크립트

```markdown
# 베르누이의 원리 시각화

## 개요
베르누이의 원리는 유체 속도와 압력의 관계를 설명합니다.

## 본문
비행기 날개 주변의 공기 흐름을 시각화하여 압력 차이를 보여줍니다...

## 결론
이 원리는 비행기가 뜰 수 있는 기본 원리입니다.
```

## 🎯 생성 결과

- **키프레임**: 스크립트 기반 자동 계산
- **프롬프트**: 공학 전문 용어 사용
- **이미지**: 고품질 공학 시각화
- **비디오**: 전문 편집 스타일

## 🔍 기술 스택

- **AI**: Ollama (Llama3.2) + GPT
- **이미지**: Google Flow/Imagen fallback (외부 이미지 provider 미연동)
- **비디오**: MoviePy
- **TTS**: gTTS as the no-key online default; ElevenLabs and Google Cloud TTS are optional
- **인증**: Firebase Authentication, GitHub OAuth
- **스토리지**: Vercel Blob, Firebase Storage, AWS S3, 로컬 스토리지
- **웹 서버**: Flask
- **배포**: Vercel
- **파이썬**: 3.12+

## 📝 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| USE_LOCAL_AI | 로컬 AI 사용 여부 | true |
| OLLAMA_HOST | Ollama 서버 주소 | http://localhost:11434 |
| OLLAMA_MODEL | Ollama 모델 | llama3.2:latest |
| TTS_PROVIDER | 음성 엔진 (`gtts`, `elevenlabs`, `google`, `edge-tts`) | `gtts` |
| TTS_LANGUAGE | 음성 언어 코드; 온라인 TTS에 네트워크 필요 | `ko-KR` |
| TTS_VOICE | ElevenLabs 음성 ID (선택) | 엔진 기본 음성 |
| GOOGLE_API_KEY | Gemini 이미지 생성 API 키 | - |
| GOOGLE_IMAGE_MODEL | Gemini 네이티브 이미지 생성 모델 | `gemini-nano-banana-2.1` |
| BLOB_READ_WRITE_TOKEN | Vercel Blob 업로드 토큰 | - |
| AUTH_TOKEN | Ollama 웹 API용 Bearer 토큰 | - |
| VIDEO_DURATION | 비디오 길이 (초) | 30 |
| FPS | 프레임 레이트 | 30 |

gTTS는 별도 API 키 없이 인터넷 연결로 음성을 생성합니다. 인터넷 연결이나
TTS 공급자가 실패하면 합성 톤 폴백이 사용될 수 있으며, 이 출력은 실제 음성
내레이션이 아닙니다. 결과에서 `audio_provider`, `used_fallback`, `provider_error`
값을 확인하세요. ElevenLabs는 유효한 키와 voice ID가 준비된 경우에만 선택하세요.
gTTS는 온라인 서비스이므로 오프라인 음성 합성을 보장하지 않습니다.

웹 스튜디오 영상에는 실제 3D 모델 렌더링이 아니라 장면 이미지와 그래픽 레이어를
분리해 움직이는 2.5D 패럴랙스/줌 연출이 적용됩니다. 음성 자막은 MP4에 포함되고
별도 SRT도 제공됩니다. Edge TTS 문장 타이밍을 받을 수 있으면 이를 사용하고,
기본 gTTS는 문장별 오디오 길이를 재어 문장 경계를 맞춥니다. 문장 내부의 단어 단위
음성 인식 정렬은 아니며, 음성 제공자 제약이나 폴백 시 대본 길이 기반 추정으로
전환될 수 있습니다. 실제 3D 에셋/모델 렌더를 보장하지 않습니다.

`/ollama/*` 웹 API에는 `AUTH_TOKEN` 또는 검증된 Firebase ID token이 필요합니다.
Gemini 네이티브 이미지 생성이 설정되지 않았거나 실패하면 영상은 로컬에서 렌더링한
공학 도식을 사용하며, 이 이미지는 외부 AI 이미지가 아닙니다. 실제 공급자 응답과
`local-renderer` 출처는 결과에 구분 표시됩니다. MP4 생성은 인코딩 후 결과 파일의
비디오 프레임과 오디오 스트림을 검증한 경우에만 성공 처리합니다.

웹 스튜디오는 Flask 서버의 `/`에서 제공되며, `/api/generate`는 `AUTH_TOKEN` 또는
검증된 Firebase ID token을 Bearer 토큰으로 요구합니다. 토큰은 폼에 입력해 요청할
수 있으며 브라우저 저장소에는 저장되지 않습니다. 생성한 MP4는 설정된 원격 저장소로
업로드하고, 업로드 실패 시 결과에 표시한 뒤 로컬 파일로 제공합니다. 로컬 MP4 URL은
임의 식별자를 사용하며 서버 프로세스가 유지되는 동안 재생/다운로드할 수 있습니다.
이 로컬 파일 제공 방식은 서버리스/다중 인스턴스 배포용 영구 저장소를 대체하지 않습니다.

## 🐛 문제 해결

### Ollama 연결 문제
```bash
# Ollama 서버 확인
curl http://localhost:11434/api/tags

# 서버 재시작
ollama serve
```

### 이미지 생성 실패
- `GOOGLE_API_KEY`가 유효하고 Gemini API 이미지 생성에 접근 가능한지 확인
- `GOOGLE_IMAGE_MODEL`의 이용 가능 여부와 할당량 확인
- API 키/모델을 사용할 수 없으면 로컬 절차형 공학 도식이 대신 표시됩니다.

### 인증/스토리지 문제
인증 및 스토리지 관련 문제는 `INSTALL_AUTH.md` 파일을 참조하세요.

## 🔐 인증 및 스토리지 설정

### 빠른 설정 (1분 완성)

**Firebase 및 GitHub OAuth 설정을 위한 최단 경로:**

```bash
# 1. 빠른 설정 스크립트 실행
py -3.14 quick_setup.py

# 2. Firebase 설정 (선택사항)
# - Firebase Console 접속: https://console.firebase.google.com/
# - 프로젝트 생성 및 Authentication 활성화
# - 서비스 계정 키 다운로드 → firebase-adminsdk-key.json으로 이름 변경
# - 프로젝트 루트 디렉토리에 파일 배치
# - quick_setup.py 다시 실행

# 3. GitHub OAuth 설정 (선택사항)
# - GitHub OAuth Apps: https://github.com/settings/developers
# - New OAuth App 생성
# - .env 파일에 Client ID와 Secret 추가
# - quick_setup.py 다시 실행
```

### 상세 설정 가이드
- **[Firebase 설정 가이드](FIREBASE_SETUP_GUIDE.md)**: Firebase Authentication 및 Storage 상세 설정
- **[GitHub OAuth 설정 가이드](GITHUB_OAUTH_SETUP_GUIDE.md)**: GitHub OAuth 상세 설정
- **[일반 인증/스토리지 가이드](INSTALL_AUTH.md)**: AWS S3, Vercel 배포 설정

### .env 파일 설정
```env
# Firebase 설정 (선택사항)
FIREBASE_ENABLED=true
FIREBASE_KEY_PATH=firebase-adminsdk-key.json

# GitHub OAuth 설정 (선택사항)
GITHUB_ENABLED=true
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/auth/github/callback

# 스토리지 설정
STORAGE_TYPE=local  # local, firebase, s3
LOCAL_STORAGE_DIR=uploads
```

### 추가 환경 변수

#### 인증 설정
|| 변수 | 설명 | 기본값 |
||------|------|--------|
|| FIREBASE_ENABLED | Firebase 인증 사용 여부 | false |
|| FIREBASE_KEY_PATH | Firebase 서비스 계정 키 경로 | - |
|| GITHUB_ENABLED | GitHub OAuth 사용 여부 | false |
|| GITHUB_CLIENT_ID | GitHub OAuth Client ID | - |
|| GITHUB_CLIENT_SECRET | GitHub OAuth Client Secret | - |
|| GITHUB_REDIRECT_URI | GitHub OAuth 리디렉션 URI | http://localhost:8000/auth/github/callback |

#### 스토리지 설정
|| 변수 | 설명 | 기본값 |
||------|------|--------|
|| STORAGE_TYPE | 스토리지 타입 (local, firebase, s3) | local |
|| LOCAL_STORAGE_DIR | 로컬 스토리지 디렉토리 | uploads |
|| S3_BUCKET_NAME | AWS S3 버킷 이름 | - |
|| AWS_ACCESS_KEY_ID | AWS 액세스 키 ID | - |
|| AWS_SECRET_ACCESS_KEY | AWS 시크릿 액세스 키 | - |
|| AWS_REGION | AWS 리전 | us-east-1 |

## 📄 라이선스

MIT License

## 🤝 기여

환영합니다! 이슈를 제출하거나 PR을 보내주세요.