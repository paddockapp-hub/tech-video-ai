# GitHub & Vercel 배포 가이드

## 🎯 현재 상태
- ✅ Git 저장소 초기화 완료
- ✅ Vercel 설정 파일 존재
- ⚠️ GitHub 원격 저장소 연결 필요
- ⚠️ 프로젝트 구조 최적화 필요

## 🚀 GitHub 연동 방법

### 1단계: GitHub 저장소 생성
1. [GitHub](https://github.com/) 접속
2. "New repository" 클릭
3. 저장소 이름: `engineering-shorts-generator`
4. Public/Private 선택
5. "Create repository" 클릭

### 2단계: 로컬 Git 저장소 연결
```bash
# 이미 수행됨: git init

# 원격 저장소 추가
git remote add origin https://github.com/YOUR_USERNAME/engineering-shorts-generator.git

# 원격 저장소 확인
git remote -v
```

### 3단계: 프로젝트 파일 커밋
```bash
# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "Initial commit: Engineering Shorts Generator with Firebase & GitHub OAuth"

# 푸시
git push -u origin main
```

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
Framework Preset: Python
Root Directory: ./
Build Command: (비워둠)
Output Directory: (비워둠)
```

#### 3단계: 환경 변수 설정
Vercel Dashboard → Settings → Environment Variables:

```env
USE_LOCAL_AI=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
STORAGE_TYPE=local
FIREBASE_ENABLED=false
GITHUB_ENABLED=false
```

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