# Stable Diffusion 설치 가이드 (간단 버전)

## 개요
로컬 AI 이미지 생성을 위해 Stable Diffusion을 설치하는 방법입니다.

## 설치 순서

### 1단계: Git 설치 (필수)
Git이 없으면 Stable Diffusion을 다운로드할 수 없습니다.

**자동 설치 (권장):**
```powershell
winget install Git.Git
```

**수동 설치:**
1. https://git-scm.com/download/win 방문
2. Windows용 Git 다운로드 및 설치
3. 설치 후 터미널 재시작

### 2단계: Python 3.12 확인
이미 설치되어 있다고 하셨으므로 확인만 합니다:
```powershell
py -3.12 --version
```

### 3단계: Stable Diffusion WebUI 다운로드
```powershell
cd C:\Users\jae55\.devin\engineering-shorts-generator
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui.git
cd stable-diffusion-webui
```

### 4단계: WebUI 설정 파일 수정
`webui-user.bat` 파일을 다음 내용으로 수정:
```batch
@echo off
set PYTHON=py -3.12
set GIT=git
set VENV_DIR=venv
set COMMANDLINE_ARGS=--api --listen --port 7860
call webui.bat
```

### 5단계: WebUI 실행
```powershell
webui-user.bat
```

**참고:** 첫 실행은 10-30분 정도 걸릴 수 있습니다.

### 방법 2: ComfyUI (대안)

1. **ComfyUI 다운로드**
   ```bash
   git clone https://github.com/comfyanonymous/ComfyUI.git
   cd ComfyUI
   ```

2. **실행**
   ```bash
   run_nvidia_gpu.bat  # NVIDIA GPU 사용 시
   ```

### 방법 3: 이미 설치된 경우
이미 Stable Diffusion이 설치되어 있다면 포트 7860에서 실행 중인지 확인하세요.

## 설정 확인

설치 후 다음 설정을 `.env` 파일에 업데이트하세요:
```bash
SD_HOST=http://127.0.0.1:7860
```

## 테스트

설치가 완료되면 다음 명령어로 테스트하세요:
```bash
curl http://127.0.0.1:7860/sdapi/v1/sd-models
```

## 문제 해결

### Python 버전 문제
- Python 3.14을 사용 중인 경우, Python 3.10 또는 3.11을 별도로 설치
- 가상 환경을 사용하여 Python 버전 관리

### GPU 문제
- NVIDIA GPU 필요 (CUDA 지원)
- AMD GPU의 경우 ROCm 버전 필요

### 메모리 문제
- 8GB 이상의 RAM 권장
- VRAM 4GB 이상 권장