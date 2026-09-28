# 🚀 내일부터 해야 할 단계별 가이드

## 📋 현재 상태 점검 결과

### ✅ 오류 상태: 해결됨
- **Import 문제**: 상대 import 경로를 절대 경로로 수정 완료
- **타입 힌트**: `Any` 타입 추가로 타입 오류 해결
- **의존성**: `requirements.txt`에 필요한 패키지 모두 포함
- **문법 오류**: 모든 문법 오류 수정 완료

### ⚠️ 현재 제한 사항
- **Python 미설치**: 시스템에 Python이 설치되어 있지 않음
- **API 키 미설정**: OpenAI, Google Cloud API 키 필요
- **외부 라이브러리 미설치**: moviepy, openai 등 필요

---

## 🎯 내일부터 해야 할 작업 (순서대로)

### 1단계: Python 설치 (가장 중요!) ⏰ 약 30분

#### Windows용 Python 설치
1. **Python 다운로드**
   - https://www.python.org/downloads/ 접속
   - **Python 3.10 이상** 버전 다운로드 (3.11 또는 3.12 추천)
   - Windows installer (64-bit) 선택

2. **설치 시 주의사항** ⚠️
   - **"Add Python to PATH" 체크박스 반드시 체크!**
   - 이 옵션을 체크하지 않으면 명령어에서 Python을 사용할 수 없음

3. **설치 확인**
   ```bash
   # 명령 프롬프트(CMD)나 PowerShell에서 실행
   python --version
   # Python 3.x.x 가 나오면 성공
   ```

---

### 2단계: 프로젝트 폴더로 이동 및 의존성 설치 ⏰ 약 10-15분

#### 프로젝트 폴더 이동
```bash
# 현재 위치에서 프로젝트 폴더로 이동
cd engineering-shorts-generator
```

#### 가상 환경 생성 (권장)
```bash
# 가상 환경 생성
python -m venv venv

# 가상 환경 활성화 (Windows)
venv\Scripts\activate

# 활성화되면 (venv) 프롬프트가 표시됨
```

#### 의존성 설치
```bash
# requirements.txt에 있는 모든 패키지 설치
pip install -r requirements.txt

# 설치 과정에서 오류가 발생하면 개별적으로 설치 시도
pip install openai google-generativeai google-cloud-texttospeech
pip install pillow opencv-python moviepy pydub
pip install python-dotenv requests gtts pygame
```

#### 설치 확인
```bash
# 설치된 패키지 확인
pip list
```

---

### 3단계: API 키 획득 ⏰ 약 20-30분

#### OpenAI API 키
1. **OpenAI 계정 생성**
   - https://platform.openai.com/ 접속
   - 회원가입 (로그인)

2. **API 키 생성**
   - 우측 상단 프로필 → "API Keys" 클릭
   - "Create new secret key" 클릭
   - 키 이름 설정 (예: "engineering-shorts")
   - 생성된 키를 **반드시 복사** (다시 볼 수 없음!)

3. **비용 확인**
   - 무료 크레딧이 있을 수 있음
   - GPT-4 사용 시 유료일 수 있음
   - 처음에는 gpt-3.5-turbo 사용 권장 (저렴)

#### Google Cloud API 키
1. **Google Cloud 계정 생성**
   - https://console.cloud.google.com/ 접속
   - Google 계정으로 로그인

2. **프로젝트 생성**
   - "Select a project" → "NEW PROJECT"
   - 프로젝트 이름 설정 (예: "engineering-shorts")

3. **API 활성화**
   - "APIs & Services" → "Library"
   - 다음 API 검색 및 활성화:
     - "Generative Language API"
     - "Cloud Text-to-Speech API"

4. **API 키 생성**
   - "APIs & Services" → "Credentials"
   - "Create Credentials" → "API Key"
   - 생성된 키 복사

5. **결제 설정** ⚠️
   - Google Cloud는 결제 정보 등록 필요
   - 무료 크레딧 제공 (보통 $300)
   - 처음 사용 시 약간의 비용 발생 가능

---

### 4단계: 환경 변수 설정 ⏰ 약 5분

#### .env 파일 생성
```bash
# .env.example 파일을 .env로 복사
copy .env.example .env

# 또는 직접 .env 파일 생성
```

#### .env 파일 편집
```env
# OpenAI API Configuration
OPENAI_API_KEY=sk-여기에_OpenAI_API_키_입력
OPENAI_MODEL=gpt-4  # 또는 gpt-3.5-turbo (저렴함)

# Google AI Configuration  
GOOGLE_API_KEY=여기에_Google_API_키_입력
GOOGLE_MODEL=gemini-pro

# Video Generation Configuration
VIDEO_DURATION=30
FPS=30
IMAGE_WIDTH=1080
IMAGE_HEIGHT=1920

# Output Configuration
OUTPUT_DIR=output
TEMP_DIR=temp

# TTS Configuration
GOOGLE_TTS_ENABLED=false  # 처음에는 false로 설정 (gTTS 사용)
```

---

### 5단계: 기능 테스트 ⏰ 약 10분

#### 기본 import 테스트
```bash
# 가상 환경이 활성화된 상태에서
python simple_test.py
```

**기대 결과:**
```
=== 모듈 Import 테스트 ===

1. script_analyzer 모듈 테스트...
   ✓ ScriptAnalyzer import 성공
2. gpt_service 모듈 테스트...
   ✓ GPTService import 성공
... (모든 모듈이 성공해야 함)
```

#### 시스템 상태 확인
```bash
python check_status.py
```

**기대 결과:**
- 모든 항목이 "✓ 통과"여야 함
- Python 문법, 임포트 의존성 등 확인

---

### 6단계: 첫 번째 실행 (이미지만 생성) ⏰ 약 5-10분

#### API 키 없이 테스트 (더미 이미지)
```bash
python src/main.py example_script.md --mode images
```

**기대 결과:**
- output/images/ 폴더에 더미 이미지 생성
- 오류 없이 완료되어야 함

#### API 키 설정 후 실제 이미지 생성
```bash
# .env 파일에 API 키가 설정된 상태에서
python src/main.py example_script.md --mode images
```

**기대 결과:**
- GPT가 프롬프트 생성
- Google Flow가 실제 이미지 생성
- output/images/ 폴더에 고품질 이미지 저장

---

### 7단계: 전체 워크플로우 테스트 ⏰ 약 15-20분

#### 완전한 비디오 생성 (TTS 제외)
```bash
python src/main.py example_script.md --skip-tts
```

**기대 결과:**
1. 스크립트 분석
2. 키프레임 계산
3. 이미지 생성 (기본 + 인포그래픽)
4. 비디오 제작
5. output/final_video.mp4 생성

#### TTS 포함 전체 워크플로우
```bash
python src/main.py example_script.md
```

**기대 결과:**
- 위의 모든 단계 + 음성 생성
- 음성이 포함된 최종 비디오 생성

---

## 🛠️ 문제 해결 가이드

### Python 설치 문제
**문제:** "python 명령어를 찾을 수 없음"
**해결:**
1. Python을 재설치하며 "Add Python to PATH" 체크
2. 또는 수동으로 PATH 환경 변수에 Python 경로 추가

### pip 설치 문제
**문제:** "pip 명령어를 찾을 수 없음"
**해결:**
```bash
python -m pip install --upgrade pip
```

### 패키지 설치 오류
**문제:** 특정 패키지 설치 실패
**해결:**
```bash
# 개별적으로 설치 시도
pip install --upgrade <패키지명>

# 또는 conda 사용 (Anaconda 설치된 경우)
conda install <패키지명>
```

### API 키 오류
**문제:** "API key가 유효하지 않음"
**해결:**
1. API 키가 올바르게 복사되었는지 확인
2. API 키에 공백이 없는지 확인
3. API 키가 만료되지 않았는지 확인

### FFmpeg 오류
**문제:** moviepy에서 FFmpeg 관련 오류
**해결:**
1. FFmpeg 다운로드: https://ffmpeg.org/download.html
2. 압축 해제 후 PATH 환경 변수에 추가
3. 또는 `imageio-ffmpeg` 패키지 설치:
```bash
pip install imageio-ffmpeg
```

---

## 📅 1일차 작업 체크리스트

### 오전 (약 1시간)
- [ ] Python 3.10+ 설치
- [ ] Python 설치 확인 (`python --version`)
- [ ] 프로젝트 폴더로 이동
- [ ] 가상 환경 생성 및 활성화

### 점심 (약 30분)
- [ ] 의존성 설치 (`pip install -r requirements.txt`)
- [ ] 설치된 패키지 확인 (`pip list`)

### 오후 (약 1시간)
- [ ] OpenAI API 키 획득
- [ ] Google Cloud API 키 획득
- [ ] .env 파일 생성 및 설정

### 저녁 (약 30분)
- [ ] 기본 import 테스트 (`python simple_test.py`)
- [ ] 시스템 상태 확인 (`python check_status.py`)
- [ ] 첫 번째 이미지 생성 테스트

---

## 🎯 2일차 작업 (첫 번째 성공 후)

### 전체 워크플로우 테스트
- [ ] TTS 제외 전체 워크플로우 실행
- [ ] TTS 포함 전체 워크플로우 실행
- [ ] 생성된 비디오 품질 확인

### 커스터마이징
- [ ] 자신만의 스크립트 작성
- [ ] 다양한 옵션 테스트 (플랫폼, 워터마크 등)
- [ ] 파라미터 조정 (이미지 크기, FPS 등)

---

## 💡 팁

1. **처음에는 비용 절약**
   - gpt-3.5-turbo 사용 (gpt-4보다 저렴)
   - 짧은 스크립트로 테스트
   - TTS는 gTTS 사용 (무료)

2. **단계별 진행**
   - 한 단계씩 완료 후 다음 단계로
   - 각 단계에서 성공 확인 후 진행

3. **오류 로그 확인**
   - 오류 발생 시 전체 메시지 읽기
   - 구글에 오류 메시지 검색

4. **백업**
   - .env 파일은 절대 GitHub에 올리지 않기
   - 작업 중인 스크립트 정기적으로 백업

---

## 🆘 도움이 필요할 때

### 일반적인 문제
- Stack Overflow: 오류 메시지로 검색
- GitHub Issues: 각 패키지의 이슈 트래커

### API 관련 문제
- OpenAI Docs: https://platform.openai.com/docs
- Google Cloud Docs: https://cloud.google.com/docs

### 이 프로젝트 관련
- README.md: 상세 사용 설명
- PROJECT_STATUS.md: 현재 완성도 보고서

---

## 🎉 성공 기준

### 기본 성공
- ✅ Python이 정상적으로 설치됨
- ✅ 모든 의존성이 설치됨
- ✅ API 키가 설정됨
- ✅ `simple_test.py`가 통과함

### 중급 성공
- ✅ 이미지가 생성됨
- ✅ 비디오가 제작됨
- ✅ 예제 스크립트로 완전한 워크플로우 작동

### 고급 성공
- ✅ 자신만의 스크립트로 비디오 제작
- ✅ 다양한 옵션과 커스터마이징
- ✅ 일괄 처리 기능 활용

---

**내일부터 이 가이드대로 차근차근 진행하시면 1-2일 내에 완전한 공학 쇼츠 생성 시스템을 구축할 수 있습니다!** 🚀