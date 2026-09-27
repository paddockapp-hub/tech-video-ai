"""
Ollama → v0.dev 콘텐츠 생성기 (자동 실행 버전)
엔지니어링 쇼츠 시스템용 v0.dev 웹사이트 콘텐츠 자동 생성
"""

import sys
import os
from pathlib import Path

# UTF-8 인코딩 설정
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# src 디렉토리를 경로에 추가
src_path = Path(__file__).parent / 'src'
if src_path.exists():
    sys.path.insert(0, str(src_path))

from ollama_service import OllamaService
from script_analyzer import ScriptAnalyzer

def generate_landing_page_content():
    """랜딩 페이지용 v0 콘텐츠 생성"""
    
    print("=== v0.dev 랜딩 페이지 콘텐츠 생성 ===\n")
    
    ollama = OllamaService()
    
    prompt = """
    엔지니어링 쇼츠 자동 생성 시스템을 위한 모던한 랜딩 페이지를 만들어줘:
    
    시스템 정보:
    - 이름: Engineering Shorts Generator
    - 설명: AI 기반 공학 쇼츠 자동 생성 시스템
    - 주요 기능: 
      * 로컬 GPT (Ollama Llama3.2)
      * 이미지 생성 (Google Flow API)
      * 비디오 편집 (MoviePy)
      * 인증 시스템 (Firebase, GitHub OAuth)
      * 스토리지 (Firebase Storage, AWS S3)
    
    웹사이트 구조:
    1. 헤더 섹션:
       - 로고: 🎬
       - 타이틀: Engineering Shorts Generator
       - 네비게이션: 기능, 가격, 문서, 로그인 버튼
    
    2. 히어로 섹션:
       - 메인 제목: AI 기반 공학 쇼츠 자동 생성
       - 서브 제목: Ollama와 Google Flow를 사용하여 공학 원리를 설명하는 짧은 영상을 자동으로 생성합니다
       - CTA 버튼: 무료로 시작하기 (파란색, 큰 버튼)
       - 데모 이미지/비디오 플레이스홀더
    
    3. 특징 섹션 (3열 그리드):
       - 카드 1: 로컬 GPT - Ollama Llama3.2로 전문 공학 프롬프트 생성
       - 카드 2: 이미지 생성 - Google Flow API로 고품질 공학 시각화
       - 카드 3: 비디오 편집 - MoviePy로 전문 편집 스타일
       - 카드 4: 인증 시스템 - Firebase & GitHub OAuth 지원
       - 카드 5: 스토리지 - Firebase Storage, AWS S3, 로컬 스토리지
       - 카드 6: 웹 서버 - Flask REST API 제공
    
    4. 데모 섹션:
       - 제목: 실제 생성 예시
       - 데모 비디오 플레이스홀더
       - 성능 지표 (이미지 30개, 비디오 1개, 처리 시간 등)
    
    5. 기술 스택 섹션:
       - 제목: 사용된 기술
       - 아이콘 그리드: Python, Ollama, Google Cloud, Firebase, GitHub, Vercel
    
    6. CTA 섹션:
       - 제목: 지금 시작하세요
       - 설명: 1분 만에 설정 완료
       - 이메일 입력 폼
       - 시작하기 버튼
    
    7. 푸터 섹션:
       - 저작권: 2024 Engineering Shorts Generator
       - 링크: 문서, GitHub, 지원, 개인정보처리방침
       - 소셜 미디어 아이콘
    
    디자인 요구사항:
    - Tailwind CSS 사용
    - 다크 모드 지원 (기본 다크 테마)
    - 모던하고 클린한 디자인
    - 그라데이션 배경
    - 애니메이션 효과 (hover, fade-in)
    - 반응형 디자인 (모바일 최적화)
    - 프로그레시브 웹 앱 (PWA) 지원
    
    색상 팔레트:
    - 주요 색상: 파란색 (#3B82F6)
    - 보조 색상: 보라색 (#8B5CF6)
    - 배경: 다크 그레이 (#0F172A)
    - 텍스트: 흰색 (#FFFFFF)
    - 카드: 중간 그레이 (#1E293B)
    """
    
    try:
        content = ollama.generate_text(prompt)
        
        print("=== 생성된 v0.dev 콘텐츠 ===")
        print(content)
        print("\n=== 사용 방법 ===")
        print("1. 위 콘텐츠를 복사하세요")
        print("2. https://v0.dev/ 접속")
        print("3. 입력창에 콘텐츠를 붙여넣으세요")
        print("4. 'Generate' 버튼 클릭")
        
        # 파일로 저장
        output_file = "v0_landing_page_content.txt"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"\n콘텐츠가 {output_file}에 저장되었습니다")
        
        return content
        
    except Exception as e:
        print(f"오류 발생: {e}")
        return None

def main():
    """메인 함수 - 자동으로 랜딩 페이지 콘텐츠 생성"""
    print("=== Ollama → v0.dev 콘텐츠 생성기 ===\n")
    
    # 자동으로 랜딩 페이지 콘텐츠 생성
    generate_landing_page_content()
    
    print("\n=== 완료 ===")
    print("v0_landing_page_content.txt 파일을 확인하세요")

if __name__ == '__main__':
    main()