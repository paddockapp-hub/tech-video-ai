# 🤖 로컬 AI 내장 방법 가이드

## 💡 현재 시스템의 문제점
- OpenAI GPT: 유료 API, 인터넷 필수
- Google Cloud: 유료 API, 인터넷 필수
- 비용 발생, 의존성 문제

## 🚀 로컬 AI 대안들

### 1. Ollama (가장 추천 ⭐)
**장점:**
- 완전 무료, 로컬 실행
- 설치 쉽고 사용 간편
- 다양한 모델 지원 (Llama, Mistral, Gemma 등)
- API와 호환되는 인터페이스

**설치:**
```bash
# Windows용 Ollama 다운로드
# https://ollama.ai/download

# 설치 후 명령 프롬프트에서
ollama pull llama3.2
ollama pull mistral
```

**사용 예시:**
```python
import requests

def ask_ollama(prompt, model="llama3.2"):
    response = requests.post('http://localhost:11434/api/generate', json={
        'model': model,
        'prompt': prompt,
        'stream': False
    })
    return response.json()['response']
```

---

### 2. LocalAI
**장점:**
- OpenAI API와 호환
- 다양한 오픈소스 모델 지원
- 로컬에서 완전 실행

**설치:**
```bash
# Docker 설치 필요
docker run -p 8080:8080 -v localai-data:/data/models \
  localai/localai:latest --models-path /data/models
```

---

### 3. GPT4All
**장점:**
- 데스크톱 앱으로 쉬운 설치
- GPU 가속 지원
- 오프라인 작동

**설치:**
```bash
# https://gpt4all.io/에서 다운로드
# 설치 후 모델 다운로드
```

---

### 4. Hugging Face Transformers (개발자용)
**장점:**
- Python 라이브러리로 직접 통합
- 수천 개의 무료 모델
- 완전 커스터마이즈 가능

**설치:**
```bash
pip install transformers torch
```

**사용 예시:**
```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_name = "microsoft/DialoGPT-medium"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

def generate_text(prompt):
    inputs = tokenizer.encode(prompt + tokenizer.eos_token, return_tensors="pt")
    outputs = model.generate(inputs, max_length=1000, pad_token_id=tokenizer.eos_token_id)
    return tokenizer.decode(outputs[0])
```

---

### 5. Stable Diffusion (이미지 생성용)
**장점:**
- 고품질 이미지 생성
- 완전 무료, 로컬 실행
- 다양한 커스터마이징

**설치 방법:**

#### Automatic1111 (가장 인기)
```bash
git clone https://github.com/AUTOMATIC1111/stable-diffusion-webui
cd stable-diffusion-webui
webui-user.bat
```

#### ComfyUI (고급 사용자)
```bash
git clone https://github.com/comfyanonymous/ComfyUI
cd ComfyUI
pip install -r requirements.txt
python main.py
```

---

### 6. 무료 API 서비스 (설치 불필요)

#### Groq (매우 빠름 ⚡)
```python
from groq import Groq

client = Groq(api_key="gsk_...") # 무료 키 발급
response = client.chat.completions.create(
    model="llama3-70b-8192",
    messages=[{"role": "user", "content": "Hello"}]
)
```

#### Hugging Face Inference API
```python
import requests

API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
headers = {"Authorization": "Bearer hf_..."} # 무료 키

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()
```

---

## 🎯 추천 조합

### 1. 완전 로컬 (추천)
- **텍스트**: Ollama (Llama3.2)
- **이미지**: Stable Diffusion (Automatic1111)
- **장점**: 완전 무료, 오프라인, 프라이버시

### 2. 혼합 (빠른 설정)
- **텍스트**: Groq API (무료, 매우 빠름)
- **이미지**: Stable Diffusion (로컬)
- **장점**: 설정 쉽고 성능 좋음

### 3. 개발자 친화적
- **텍스트**: Hugging Face Transformers
- **이미지**: ComfyUI API
- **장점**: 완전 제어 가능

---

## 🔧 현재 프로젝트에 적용 방법

### Ollama 통합 예시

#### 1. 새로운 서비스 모듈 생성
```python
# src/ollama_service.py
import requests
import json

class OllamaService:
    def __init__(self, host="http://localhost:11434"):
        self.host = host
        
    def generate_text(self, prompt, model="llama3.2"):
        response = requests.post(f'{self.host}/api/generate', json={
            'model': model,
            'prompt': prompt,
            'stream': False
        })
        return response.json()['response']
    
    def analyze_script_for_images(self, script_text, num_keyframes):
        prompt = f"""
다음 스크립트를 바탕으로 {num_keyframes}개의 키프레임 이미지를 생성하기 위한 프롬프트를 만들어주세요.

스크립트: {script_text}

JSON 형식으로 응답해주세요:
[{{"scene_number": 1, "base_prompt": "...", "infographic_prompt": "..."}}]
"""
        response = self.generate_text(prompt)
        return json.loads(response)
```

#### 2. main.py에서 교체
```python
# 기존
# from gpt_service import GPTService
# self.gpt_service = GPTService(self.config)

# 새로운
from ollama_service import OllamaService
self.gpt_service = OllamaService()
```

### Stable Diffusion 통합 예시

#### 1. 새로운 이미지 서비스
```python
# src/stable_diffusion_service.py
import requests
import base64

class StableDiffusionService:
    def __init__(self, host="http://127.0.0.1:7860"):
        self.host = host
        
    def generate_image(self, prompt, output_path):
        payload = {
            "prompt": prompt,
            "steps": 20,
            "width": 1080,
            "height": 1920
        }
        response = requests.post(f"{self.host}/sdapi/v1/txt2img", json=payload)
        result = response.json()
        
        # 이미지 저장
        image_data = base64.b64decode(result["images"][0])
        with open(output_path, "wb") as f:
            f.write(image_data)
        
        return output_path
```

---

## 📊 성능 비교

| 방식 | 비용 | 속도 | 품질 | 설치 난이도 |
|------|------|------|------|------------|
| OpenAI GPT | 유료 | 빠름 | 최고 | 쉬움 |
| Ollama | 무료 | 중간 | 좋음 | 쉬움 |
| Groq API | 무료 | 매우 빠름 | 좋음 | 쉬움 |
| Stable Diffusion | 무료 | 느림 | 최고 | 중간 |
| Hugging Face | 무료 | 느림 | 다양함 | 어려움 |

---

## 🎯 추천 시작 방법

### 1단계: Ollama 설치 (5분)
```bash
# https://ollama.ai/download
# 설치 후
ollama pull llama3.2
```

### 2단계: 테스트
```python
import requests

response = requests.post('http://localhost:11434/api/generate', json={
    'model': 'llama3.2',
    'prompt': 'Hello, how are you?',
    'stream': False
})
print(response.json()['response'])
```

### 3단계: 프로젝트에 통합
- 위의 예시 코드로 서비스 모듈 교체
- 기존 코드와 호환되도록 인터페이스 유지

---

어떤 방식이 가장 마음에 드시나요? 바로 통합해 드릴 수 있습니다!