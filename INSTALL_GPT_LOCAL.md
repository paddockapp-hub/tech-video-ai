# 🤖 GPT 로컬 내장 설치 가이드 (코딩 없이)

## 🎯 개요
이 가이드는 코딩 없이 GPT를 컴퓨터에 내장하는 방법을 안내합니다. 완전 무료이며 인터넷 연결 없이도 작동합니다.

---

## 📦 설치 단계 (총 10분)

### 1단계: Ollama 다운로드 (2분)

1. **웹사이트 접속**: https://ollama.ai/download
2. **Windows 버전 다운로드**: "Windows" 버튼 클릭
3. **설치**: 다운로드한 파일 더블클릭 → "Install" 클릭
4. **완료**: 설치 완료되면 "Close" 클릭

### 2단계: GPT 모델 다운로드 (3분)

명령 프롬프트(CMD)를 열고 다음을 입력:

```bash
ollama pull llama3.2
```

*설명: 이것이 GPT와 가장 유사한 무료 모델입니다.*

### 3단계: 작동 확인 (1분)

```bash
ollama run llama3.2 "안녕하세요"
```

*응답이 오면 성공!*

### 4단계: 프로젝트 설정 (4분)

이미 모든 설정이 완료되어 있습니다. 그냥 실행하면 됩니다.

---

## 🚀 실행 방법

### 기본 실행:
```bash
cd engineering-shorts-generator
py -3.14 src/main.py example_script.md --mode images
```

### 전체 실행:
```bash
cd engineering-shorts-generator
py -3.14 src/main.py example_script.md
```

---

## 📍 Localhost 정보

**Ollama 서버 주소**: `http://localhost:11434`
**프로젝트 주소**: `C:\Users\jae55\.devin\engineering-shorts-generator`

---

## 🎉 완료

이제 컴퓨터에 GPT가 내장되었습니다! 무료로 영원히 사용할 수 있습니다.