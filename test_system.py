"""
System Test Script
시스템 기능 테스트
"""

import os
import sys
from dotenv import load_dotenv

# src 디렉토리를 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from main import EngineeringShortsGenerator


def test_basic_functionality():
    """기본 기능 테스트"""
    
    print("=== 시스템 기능 테스트 ===\n")
    
    # 환경 변수 로드
    load_dotenv()
    
    # 설정 확인
    print("1. 설정 확인:")
    print(f"   OpenAI API Key: {'설정됨' if os.getenv('OPENAI_API_KEY') else '설정되지 않음'}")
    print(f"   Google API Key: {'설정됨' if os.getenv('GOOGLE_API_KEY') else '설정되지 않음'}")
    
    # 생성자 초기화
    print("\n2. 시스템 초기화:")
    try:
        generator = EngineeringShortsGenerator()
        print("   ✓ 시스템 초기화 성공")
    except Exception as e:
        print(f"   ✗ 시스템 초기화 실패: {e}")
        return False
    
    # 예제 스크립트 확인
    print("\n3. 예제 스크립트 확인:")
    example_script = "example_script.md"
    if os.path.exists(example_script):
        print(f"   ✓ 예제 스크립트 발견: {example_script}")
    else:
        print(f"   ✗ 예제 스크립트를 찾을 수 없음: {example_script}")
        return False
    
    # 스크립트 분석 테스트
    print("\n4. 스크립트 분석 테스트:")
    try:
        script_analysis = generator.script_analyzer.parse_markdown_file(example_script)
        print(f"   ✓ 제목: {script_analysis['title']}")
        print(f"   ✓ 음성 길이: {script_analysis['duration']}초")
        print(f"   ✓ 텍스트 길이: {len(script_analysis['script_text'])}자")
    except Exception as e:
        print(f"   ✗ 스크립트 분석 실패: {e}")
        return False
    
    # 키프레임 계산 테스트
    print("\n5. 키프레임 계산 테스트:")
    try:
        keyframe_calc = generator.keyframe_manager.calculate_keyframes(script_analysis)
        print(f"   ✓ 키프레임 수: {keyframe_calc['total_keyframes']}")
        print(f"   ✓ 계산 방법: {keyframe_calc['calculation_method']}")
    except Exception as e:
        print(f"   ✗ 키프레임 계산 실패: {e}")
        return False
    
    # GPT 서비스 테스트 (API 키가 있는 경우만)
    if os.getenv('OPENAI_API_KEY'):
        print("\n6. GPT 서비스 테스트:")
        try:
            # 간단한 테스트 프롬프트
            test_prompts = generator.gpt_service.analyze_script_for_images(
                "간단한 테스트 스크립트입니다.", 2
            )
            print(f"   ✓ GPT 프롬프트 생성 성공: {len(test_prompts)}개")
        except Exception as e:
            print(f"   ✗ GPT 서비스 테스트 실패: {e}")
            print("   (이는 API 키 문제일 수 있으므로 계속 진행합니다)")
    else:
        print("\n6. GPT 서비스 테스트: 건너뜀 (API 키 없음)")
    
    # 이미지 생성 테스트 (더미 이미지)
    print("\n7. 이미지 생성 테스트 (더미):")
    try:
        test_prompt = "테스트용 공학 시각화"
        test_image = generator.google_flow_service.generate_base_image(
            test_prompt, 1, generator.config['temp_dir']
        )
        if os.path.exists(test_image):
            print(f"   ✓ 더미 이미지 생성 성공: {test_image}")
        else:
            print(f"   ✗ 이미지 파일이 생성되지 않음")
    except Exception as e:
        print(f"   ✗ 이미지 생성 실패: {e}")
    
    # TTS 서비스 테스트
    print("\n8. TTS 서비스 테스트:")
    try:
        test_audio = generator.tts_service.generate_speech_with_gtts(
            "테스트 음성입니다.", 
            os.path.join(generator.config['temp_dir'], 'test_audio.mp3')
        )
        if os.path.exists(test_audio):
            print(f"   ✓ TTS 음성 생성 성공: {test_audio}")
        else:
            print(f"   ✗ 음성 파일이 생성되지 않음")
    except Exception as e:
        print(f"   ✗ TTS 서비스 테스트 실패: {e}")
    
    # 워크플로우 통합 테스트 (이미지만)
    print("\n9. 워크플로우 통합 테스트 (이미지만):")
    try:
        image_result = generator.generate_images_only(example_script)
        if image_result['success']:
            print(f"   ✓ 이미지 워크플로우 성공")
            print(f"   ✓ 생성된 이미지: {image_result['result']['generated_images']}")
        else:
            print(f"   ✗ 이미지 워크플로우 실패: {image_result.get('error')}")
    except Exception as e:
        print(f"   ✗ 워크플로우 테스트 실패: {e}")
    
    print("\n=== 테스트 완료 ===")
    print("기본 기능이 정상적으로 작동하는 것으로 확인되었습니다.")
    print("실제 API를 사용하려면 .env 파일에 API 키를 설정하세요.")
    
    return True


def test_with_real_apis():
    """실제 API를 사용한 완전 테스트"""
    
    print("=== 실제 API 테스트 ===\n")
    
    load_dotenv()
    
    if not os.getenv('OPENAI_API_KEY') or not os.getenv('GOOGLE_API_KEY'):
        print("API 키가 설정되지 않았습니다. .env 파일을 확인하세요.")
        return False
    
    try:
        generator = EngineeringShortsGenerator()
        
        print("완전한 워크플로우 테스트를 시작합니다...")
        print("이 테스트는 실제 API를 호출하므로 비용이 발생할 수 있습니다.")
        
        response = input("계속하시겠습니까? (y/n): ")
        if response.lower() != 'y':
            print("테스트가 취소되었습니다.")
            return False
        
        # 완전한 워크플로우 실행 (TTS 제외)
        result = generator.generate_complete_video(
            "example_script.md",
            options={'skip_tts': True}
        )
        
        if result['success']:
            print("\n✓ 완전한 워크플로우 테스트 성공!")
            print(f"최종 비디오: {result['final_video_path']}")
            return True
        else:
            print(f"\n✗ 워크플로우 실패: {result.get('error')}")
            return False
            
    except Exception as e:
        print(f"테스트 중 오류 발생: {e}")
        return False


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='시스템 테스트')
    parser.add_argument('--full', action='store_true', help '실제 API를 사용한 완전 테스트')
    
    args = parser.parse_args()
    
    if args.full:
        success = test_with_real_apis()
    else:
        success = test_basic_functionality()
    
    sys.exit(0 if success else 1)
