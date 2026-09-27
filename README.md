# Engineering Shorts Generator

공학 쇼츠 자동 생성 시스템 - 로컬 GPT + 이미지 생성 + 인증/스토리지

## 🚀 시스템 개요

이 시스템은 공학 원리를 설명하는 짧은 영상(쇼츠)을 자동으로 생성합니다:

1. **스크립트 분석**: 마크다운 스크립트 분석 및 키프레임 계산
2. **로컬 GPT (Ollama)**: 실제 공학 시각화 프롬프트 생성
3. **이미지 생성**: Google Flow API로 공학 시각화 이미지 생성
4. **비디오 편집**: 키프레임 기반 비디오 생성 (옵션)
5. **인증 시스템**: Firebase, GitHub OAuth 지원
6. **스토리지**: Firebase Storage, AWS S3, 로컬 스토리지 지원
7. **웹 서버**: REST API 서버 제공

## 📋 요구사항

- Python 3.12+
- Ollama (로컬 GPT)
- Google Cloud API Key (이미지 생성)

## 🛠️ 설치

### 1. 의존성 설치
```bash
pip install -r requirements.txt
```

### 2. Ollama 설치 및 실행
```bash
# Ollama 설치 (https://ollama.ai)
# 모델 다운로드
ollama pull llama3.2

# Ollama 서버 실행
ollama serve
```

### 3. 환경 설정
`.env` 파일 설정:
```bash
# 로컬 AI 설정
USE_LOCAL_AI=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Google API 설정
GOOGLE_API_KEY=your_google_api_key_here
GOOGLE_MODEL=gemini-pro

# 비디오 설정
VIDEO_DURATION=30
FPS=30
IMAGE_WIDTH=1080
IMAGE_HEIGHT=1920
```

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

### 인증된 비디오 생성
```python
from integrated_main import IntegratedSystem

system = IntegratedSystem()
result = system.generate_authenticated_video(
    script_file_path="example_script.md",
    user_id="user123"
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

- **AI**: Ollama (Llama3.2) + Google Flow
- **비디오**: MoviePy
- **TTS**: Google Cloud TTS
- **인증**: Firebase Authentication, GitHub OAuth
- **스토리지**: Firebase Storage, AWS S3, 로컬 스토리지
- **웹 서버**: Flask
- **배포**: Vercel
- **파이썬**: 3.12+

## 📝 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| USE_LOCAL_AI | 로컬 AI 사용 여부 | true |
| OLLAMA_HOST | Ollama 서버 주소 | http://localhost:11434 |
| OLLAMA_MODEL | Ollama 모델 | llama3.2 |
| GOOGLE_API_KEY | Google API 키 | - |
| VIDEO_DURATION | 비디오 길이 (초) | 30 |
| FPS | 프레임 레이트 | 30 |

## 🐛 문제 해결

### Ollama 연결 문제
```bash
# Ollama 서버 확인
curl http://localhost:11434/api/tags

# 서버 재시작
ollama serve
```

### 이미지 생성 실패
- Google API 키 확인
- 할당량 확인
- 네트워크 연결 확인

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