# Ollama → v0.dev 통합 가이드

## 🎯 개요
Ollama에서 생성된 콘텐츠를 v0.dev (Vercel AI 웹사이트 빌더)를 사용하여 웹사이트로 변환하는 방법

## 📋 v0.dev란?
v0.dev는 Vercel에서 만든 AI 웹사이트 빌더로, 자연어로 웹사이트를 만들 수 있습니다.

## 🚀 Ollama → v0 통합 방법

### 방법 1: 직접 v0.dev 사용 (가장 쉬운 방법)

#### 1단계: Ollama에서 콘텐츠 생성
```bash
# Ollama에서 웹사이트 콘텐츠 생성
ollama run llama3.2 "공학 쇼츠 자동 생성 시스템에 대한 랜딩 페이지 콘텐츠를 만들어줘"
```

#### 2단계: v0.dev 접속
- [v0.dev](https://v0.dev/) 접속
- Vercel 계정으로 로그인

#### 3단계: 콘텐츠 입력
- v0.dev의 입력창에 Ollama에서 생성된 콘텐츠 붙여넣기
- 예시:
  ```
  공학 쇼츠 자동 생성 시스템 랜딩 페이지
  - 헤더: Engineering Shorts Generator
  - 설명: AI 기반 공학 쇼츠 자동 생성 시스템
  - 특징: 로컬 GPT, 이미지 생성, 비디오 편집
  - CTA 버튼: 시작하기
  ```

#### 4단계: 웹사이트 생성
- "Generate" 버튼 클릭
- v0가 자동으로 웹사이트 생성
- 실시간으로 프리뷰 확인

### 방법 2: 프로그래밍 방식 통합

#### 1단계: Ollama API 사용
```python
import requests
import json

def generate_content_for_v0(prompt):
    """Ollama에서 v0용 콘텐츠 생성"""
    response = requests.post('http://localhost:11434/api/generate', json={
        'model': 'llama3.2',
        'prompt': f"""다음 내용을 v0.dev 웹사이트용으로 구조화해줘:
        {prompt}
        
        형식:
        - 헤더 섹션
        - 히어로 섹션
        - 특징 섹션
        - CTA 섹션
        - 푸터 섹션
        """,
        'stream': False
    })
    
    return response.json()['response']

# 사용 예시
content = generate_content_for_v0("공학 쇼츠 자동 생성 시스템")
print(content)
```

#### 2단계: v0.dev API 사용 (현재 베타)
```python
import requests

def send_to_v0(content):
    """v0.dev에 콘텐츠 전송"""
    # v0.dev API (현재 베타, 문서 확인 필요)
    url = "https://v0.dev/api/generate"
    
    headers = {
        "Authorization": "Bearer YOUR_VERCEL_TOKEN",
        "Content-Type": "application/json"
    }
    
    data = {
        "prompt": content,
        "framework": "react"  # 또는 "nextjs", "vue"
    }
    
    response = requests.post(url, headers=headers, json=data)
    return response.json()
```

### 방법 3: 엔지니어링 쇼츠 시스템 → v0 통합

#### 1단계: 엔지니어링 쇼츠 시스템에서 콘텐츠 추출
```python
from script_analyzer import ScriptAnalyzer
from ollama_service import OllamaService

def generate_website_content(script_file):
    """스크립트에서 웹사이트 콘텐츠 생성"""
    
    # 스크립트 분석
    analyzer = ScriptAnalyzer()
    script_data = analyzer.analyze_script(script_file)
    
    # Ollama로 웹사이트 콘텐츠 생성
    ollama = OllamaService()
    
    prompt = f"""
    다음 공학 쇼츠 스크립트를 기반으로 v0.dev용 랜딩 페이지 콘텐츠를 만들어줘:
    
    제목: {script_data.get('title', '공학 쇼츠')}
    내용: {script_data.get('content', '')}
    장면 수: {len(script_data.get('scenes', []))}
    
    다음 섹션을 포함해줘:
    1. 헤더: 제목과 로고
    2. 히어로: 주요 특징 강조
    3. 특징: 시스템 기능 설명
    4. 데모: 생성된 예시
    5. CTA: 시작하기 버튼
    """
    
    website_content = ollama.generate_text(prompt)
    return website_content
```

#### 2단계: v0.dev에 업로드
```python
def upload_to_v0(website_content):
    """v0.dev에 웹사이트 콘텐츠 업로드"""
    
    # v0.dev 웹사이트 접속
    # 콘텐츠 복사하여 입력창에 붙여넣기
    # 또는 API 사용 (베타)
    
    print("v0.dev에 접속하여 다음 콘텐츠를 입력하세요:")
    print(website_content)
```

## 🎨 v0.dev 프롬프트 최적화

### 좋은 프롬프트 예시
```
공학 쇼츠 자동 생성 시스템 랜딩 페이지를 만들어줘:

헤더:
- 로고: 🎬
- 타이틀: Engineering Shorts Generator
- 네비게이션: 기능, 가격, 문서, 로그인

히어로 섹션:
- 제목: AI 기반 공학 쇼츠 자동 생성
- 설명: Ollama와 Google Flow를 사용하여 공학 원리를 설명하는 짧은 영상을 자동으로 생성합니다
- CTA 버튼: 무료로 시작하기

특징 섹션:
- 로컬 GPT: Ollama Llama3.2
- 이미지 생성: Google Flow API
- 비디오 편집: MoviePy
- 인증: Firebase & GitHub OAuth

데모 섹션:
- 생성된 쇼츠 예시 쇼케이스
- 실시간 데모 비디오

CTA 섹션:
- 지금 시작하기 버튼
- 이메일 입력 폼

푸터:
- 저작권 정보
- 소셜 미디어 링크
- 문서 링크

디자인:
- 모던하고 클린한 디자인
- 다크 모드 지원
- 반응형 디자인
- Tailwind CSS 사용
```

## 🔧 v0.dev에서 Ollama 결과물 사용하기

### 1. 텍스트 콘텐츠
```
Ollama에서 생성된 텍스트를 복사 → v0.dev 입력창에 붙여넣기 → 웹사이트 생성
```

### 2. 구조화된 데이터
```json
{
  "title": "Engineering Shorts Generator",
  "sections": [
    {
      "type": "hero",
      "content": "AI 기반 공학 쇼츠 자동 생성"
    },
    {
      "type": "features",
      "items": ["로컬 GPT", "이미지 생성", "비디오 편집"]
    }
  ]
}
```

### 3. 이미지
- Ollama에서 생성된 이미지를 v0.dev에 업로드
- 또는 이미지 URL을 프롬프트에 포함

## 🚀 실제 통합 예시

### 엔지니어링 쇼츠 시스템용 랜딩 페이지
```python
# v0_for_engineering_shorts.py
from ollama_service import OllamaService

def generate_landing_page():
    ollama = OllamaService()
    
    prompt = """
    엔지니어링 쇼츠 자동 생성 시스템을 위한 모던한 랜딩 페이지를 만들어줘:
    
    시스템 정보:
    - 이름: Engineering Shorts Generator
    - 기능: AI 기반 공학 쇼츠 자동 생성
    - 기술: Ollama Llama3.2, Google Flow, MoviePy
    - 인증: Firebase, GitHub OAuth
    
    섹션:
    1. 헤더: 로고와 네비게이션
    2. 히어로: 메인 카피와 CTA
    3. 기능: 4개 주요 기능 카드
    4. 데모: 비디오 쇼케이스
    5. 가격: 플랜 비교
    6. CTA: 최종 전환 버튼
    7. 푸터: 링크와 저작권
    
    디자인:
    - Tailwind CSS
    - 다크 모드
    - 애니메이션 효과
    - 반응형
    """
    
    content = ollama.generate_text(prompt)
    
    # 결과를 v0.dev에 복사
    print("=== v0.dev에 입력할 콘텐츠 ===")
    print(content)
    
    return content

if __name__ == '__main__':
    generate_landing_page()
```

## 📋 v0.dev 사용 팁

### 1. 구체적인 프롬프트 작성
- 섹션별로 명확하게 구분
- 디자인 스타일 지정
- 기술 스택 명시

### 2. 반복적인 개선
- 첫 번째 결과 확인
- 피드백을 바탕으로 프롬프트 수정
- 재생성

### 3. 커스터마이징
- 생성된 코드를 다운로드
- 로컬에서 수정
- Vercel에 배포

## 🎯 다음 단계

1. Ollama에서 콘텐츠 생성
2. v0.dev 접속 및 콘텐츠 입력
3. 웹사이트 생성 및 프리뷰
4. 코드 다운로드 및 커스터마이징
5. Vercel에 배포

## 🔗 관련 링크

- [v0.dev](https://v0.dev/)
- [Vercel](https://vercel.com/)
- [Ollama](https://ollama.ai/)
- [Vercel AI SDK](https://sdk.vercel.ai/)