"""
로컬 GPT 워크플로우 테스트
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from ollama_service import OllamaService

# Ollama 서비스 테스트
print("=== Ollama 서비스 워크플로우 테스트 ===")

try:
    ollama_service = OllamaService()
    print("Ollama 서비스 초기화 성공")
    
    # 연결 확인
    print("연결 확인 테스트...")
    if ollama_service.check_connection():
        print("SUCCESS: Ollama 연결 성공")
    else:
        print("FAIL: Ollama 연결 실패")
    
    # 프롬프트 생성 테스트
    print("\n프롬프트 생성 테스트...")
    test_script = "이것은 테스트 스크립트입니다. 공학 원리를 설명하는 내용입니다."
    prompts = ollama_service.analyze_script_for_images(test_script, 3)
    
    print(f"생성된 프롬프트 수: {len(prompts)}")
    for i, prompt in enumerate(prompts):
        print(f"\n프롬프트 {i+1}:")
        print(f"  - 설명: {prompt.get('description', 'N/A')}")
        print(f"  - 기본 프롬프트: {prompt.get('base_prompt', 'N/A')}")
        print(f"  - 인포그래픽 프롬프트: {prompt.get('infographic_prompt', 'N/A')}")
    
    print("\nSUCCESS: 테스트 완료")
    
except Exception as e:
    print(f"FAIL: 테스트 실패: {e}")
    import traceback
    traceback.print_exc()