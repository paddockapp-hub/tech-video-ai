# 🚀 로컬 AI 설치 가이드

## 🎯 개요
이 가이드는 무료 로컬 AI를 설치하여 공학 쇼츠 생성 시스템을 운영하는 방법을 안내합니다.

---

## 📦 필수 프로그램 설치

### 1. Ollama 설치 (텍스트 AI) ⭐

#### Windows 설치:
1. **다운로드**: https://ollama.ai/download
2. **설치**: 다운로드한 installer 실행
3. **설치 확인**: 명령 프롬프트에서 `ollama --version`

#### 모델 다운로드:
```bash
# 기본 모델 (추천)
ollama pull llama3.2

# 다른 모델 옵션
ollama pull mistral
ollama pull gemma2
```

#### 서버 시작:
```bash
# Ollama는 설치 시 자동으로 백그라운드에서 실행됩니다
# 수동 시작이 필요한 경우:
ollama serve
```

#### 연결 테스트:
```bash
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello, how are you?",
  "stream": false
}'
```

---

### 2. Stable Diffusion 설치 (이미지 AI) 🎨

#### Automatic1111 (추천 - 가장 쉬움):

##### 사전 요구사항:
- Python 3.10.6 (이미 설치됨)
- Git

##### 설치 단계:
```bash
# 1. 리포지토리 클론
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui

# 2. 디렉토리 이동
cd stable-diffusion-webui

# 3. 실행
webui-user.bat
```

##### 웹 인터페이스:
- 브라우저에서 `http://127.0.0.1:7860` 접속
- 첫 실행 시 모델 자동 다운로드 (약 10GB, 시간 소요)

##### 기본 모델:
- SD 1.5: 빠르고 품질 좋음
- SDXL: 고품질 but 느림

#### ComfyUI (고급 사용자):

##### 설치:
```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt
```

##### 모델 다운로드:
```bash
# 모델을 models/checkpoints/ 폴더에 다운로드
# Hugging Face에서 모델 검색 후 다운로드
```

---

## 🔧 시스템 설정

### 1. .env 파일 설정
```env
# 로컬 AI 모드 활성화
USE_LOCAL_AI=true

# Ollama 설정
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2

# Stable Diffusion 설정
SD_HOST=http://127.0.0.1:7860
```

### 2. 서비스 시작 순서:
1. **Ollama 시작**: 보통 자동 실행, 수동 시 `ollama serve`
2. **Stable Diffusion 시작**: `webui-user.bat` 실행
3. **프로젝트 실행**: `py -3.14 src/main.py example_script.md`

---

## 🧪 테스트

### Ollama 테스트:
```bash
cd engineering-shorts-generator
py -3.14 -c "from src.ollama_service import OllamaService; s = OllamaService(); print(s.check_connection())"
```

### Stable Diffusion 테스트:
```bash
cd engineering-shorts-generator
py -3.14 -c "from src.stable_diffusion_service import StableDiffusionService; s = StableDiffusionService(); print(s.check_connection())"
```

### 전체 시스템 테스트:
```bash
cd engineering-shorts-generator
py -3.14 src/main.py example_script.md --mode images
```

---

## 📊 성능 최적화

### Ollama:
```bash
# GPU 사용 (NVIDIA)
# Ollama가 자동으로 감지

# 메모리 제한 설정
ollama run llama3.2 --num_ctx 2048
```

### Stable Diffusion:
- **xFormers**: 성능 향상
- **TensorRT**: 더 빠른 추론
- **VRAM 최적화**: --xformers --opt-sdp-attention

---

## 🛠️ 문제 해결

### Ollama 연결 실패:
```bash
# Ollama 재시작
# 작업 관리자에서 Ollama 프로세스 종료 후 재시작

# 방화벽 확인
# localhost:11434 포트 허용
```

### Stable Diffusion 연결 실패:
```bash
# 웹 인터페이스에서 http://127.0.0.1:7860 접속 확인
# API가 활성화되어 있는지 확인
```

### 메모리 부족:
- 더 작은 모델 사용
- 배치 크기 감소
- 해상도 낮추기

---

## 💡 사용 팁

### 1. 모델 선택:
- **빠른 응답**: llama3.2 (Ollama), SD 1.5 (Stable Diffusion)
- **고품질**: mistral (Ollama), SDXL (Stable Diffusion)

### 2. 배치 처리:
- 이미지를 한 번에 여러 장 생성 가능
- 시간 절약

### 3. 캐싱:
- 생성된 이미지 자동 저장
- 재사용으로 시간 절약

---

## 🎉 완료 후

### 시스템 확인:
```bash
# 모든 서비스 확인
curl http://localhost:11434/api/tags  # Ollama
curl http://127.0.0.1:7860/sdapi/v1/sd-models  # Stable Diffusion
```

### 첫 번째 프로젝트:
```bash
cd engineering-shorts-generator
py -3.14 src/main.py example_script.md
```

---

## 📞 추가 도움

- **Ollama 문서**: https://github.com/ollama/ollama
- **Stable Diffusion 문서**: https://github.com/AUTOMATIC1111/stable-diffusion-webui
- **ComfyUI 문서**: https://github.com/comfyanonymous/ComfyUI

---

**설치 완료 후 완전 무료로 AI 기능을 사용할 수 있습니다!** 🚀