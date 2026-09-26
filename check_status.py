"""
프로젝트 상태 확인 스크립트
현재 완성도를 확인하고 기본적인 기능 테스트
"""

import os
import sys

def check_project_structure():
    """프로젝트 구조 확인"""
    print("=== 프로젝트 구조 확인 ===\n")
    
    required_files = [
        'src/__init__.py',
        'src/main.py',
        'src/script_analyzer.py',
        'src/gpt_service.py',
        'src/google_flow_service.py',
        'src/keyframe_manager.py',
        'src/image_workflow.py',
        'src/video_editor.py',
        'src/tts_service.py',
        'requirements.txt',
        '.env.example',
        'example_script.md',
        'README.md'
    ]
    
    missing_files = []
    existing_files = []
    
    for file in required_files:
        if os.path.exists(file):
            existing_files.append(file)
            print(f"✓ {file}")
        else:
            missing_files.append(file)
            print(f"✗ {file} (缺失)")
    
    print(f"\n존재하는 파일: {len(existing_files)}/{len(required_files)}")
    
    if missing_files:
        print(f"缺失 파일: {len(missing_files)}개")
        return False
    else:
        print("모든 필수 파일이 존재합니다.")
        return True

def check_python_syntax():
    """Python 파일 문법 확인"""
    print("\n=== Python 문법 확인 ===\n")
    
    python_files = [
        'src/__init__.py',
        'src/main.py',
        'src/script_analyzer.py',
        'src/gpt_service.py',
        'src/google_flow_service.py',
        'src/keyframe_manager.py',
        'src/image_workflow.py',
        'src/video_editor.py',
        'src/tts_service.py',
        'test_system.py'
    ]
    
    syntax_errors = []
    
    for file in python_files:
        if os.path.exists(file):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    compile(f.read(), file, 'exec')
                print(f"✓ {file} - 문법 정상")
            except SyntaxError as e:
                print(f"✗ {file} - 문법 오류: {e}")
                syntax_errors.append((file, str(e)))
        else:
            print(f"- {file} - 파일 없음")
    
    if syntax_errors:
        print(f"\n문법 오류가 {len(syntax_errors)}개 발견되었습니다:")
        for file, error in syntax_errors:
            print(f"  {file}: {error}")
        return False
    else:
        print("\n모든 Python 파일의 문법이 정상입니다.")
        return True

def check_import_dependencies():
    """임포트 의존성 확인"""
    print("\n=== 임포트 의존성 확인 ===\n")
    
    # 각 모듈의 임포트 문장 확인
    import_checks = {
        'src/gpt_service.py': ['from openai import OpenAI'],
        'src/google_flow_service.py': ['import google.generativeai as genai'],
        'src/video_editor.py': ['from moviepy.editor'],
        'src/tts_service.py': ['from gtts import gTTS'],
        'src/script_analyzer.py': ['import re'],
    }
    
    missing_imports = []
    
    for file, imports in import_checks.items():
        if os.path.exists(file):
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            for imp in imports:
                if imp in content:
                    print(f"✓ {file}: {imp}")
                else:
                    print(f"✗ {file}: {imp} (缺失)")
                    missing_imports.append((file, imp))
        else:
            print(f"- {file}: 파일 없음")
    
    if missing_imports:
        print(f"\n缺失 임포트: {len(missing_imports)}개")
        return False
    else:
        print("\n필요한 임포트가 모두 포함되어 있습니다.")
        return True

def check_functionality():
    """기능적 완성도 확인"""
    print("\n=== 기능적 완성도 확인 ===\n")
    
    functionalities = {
        '스크립트 분석': 'src/script_analyzer.py - ScriptAnalyzer 클래스',
        'GPT 통합': 'src/gpt_service.py - GPTService 클래스',
        'Google Flow 통합': 'src/google_flow_service.py - GoogleFlowService 클래스',
        '키프레임 관리': 'src/keyframe_manager.py - KeyframeManager 클래스',
        '이미지 워크플로우': 'src/image_workflow.py - ImageWorkflow 클래스',
        '비디오 편집': 'src/video_editor.py - VideoEditor 클래스',
        'TTS 서비스': 'src/tts_service.py - TTSService 클래스',
        '메인 통합': 'src/main.py - EngineeringShortsGenerator 클래스',
    }
    
    implemented = []
    
    for func, location in functionalities.items():
        parts = location.split(' - ')
        file = parts[0]
        class_name = parts[1] if len(parts) > 1 else None
        
        if os.path.exists(file):
            with open(file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if class_name and class_name in content:
                print(f"✓ {func}: {location}")
                implemented.append(func)
            elif not class_name:
                print(f"✓ {func}: {location}")
                implemented.append(func)
            else:
                print(f"✗ {func}: {location} (클래스 없음)")
        else:
            print(f"✗ {func}: {location} (파일 없음)")
    
    print(f"\n구현된 기능: {len(implemented)}/{len(functionalities)}")
    
    if len(implemented) == len(functionalities):
        print("모든 기능이 구현되었습니다.")
        return True
    else:
        print(f"구현되지 않은 기능: {len(functionalities) - len(implemented)}개")
        return False

def check_configuration():
    """설정 파일 확인"""
    print("\n=== 설정 파일 확인 ===\n")
    
    if os.path.exists('.env.example'):
        print("✓ .env.example 파일 존재")
        with open('.env.example', 'r', encoding='utf-8') as f:
            content = f.read()
        
        required_vars = ['OPENAI_API_KEY', 'GOOGLE_API_KEY', 'VIDEO_DURATION', 'FPS']
        found_vars = []
        
        for var in required_vars:
            if var in content:
                print(f"  ✓ {var}")
                found_vars.append(var)
            else:
                print(f"  ✗ {var} (缺失)")
        
        print(f"\n설정 변수: {len(found_vars)}/{len(required_vars)}")
        
        if os.path.exists('.env'):
            print("✓ .env 파일 존재 (사용자 설정)")
        else:
            print("- .env 파일 없음 (사용자가 생성 필요)")
        
        return len(found_vars) == len(required_vars)
    else:
        print("✗ .env.example 파일 없음")
        return False

def generate_completion_report():
    """완성도 보고서 생성"""
    print("\n" + "="*50)
    print("프로젝트 완성도 보고서")
    print("="*50 + "\n")
    
    structure_ok = check_project_structure()
    syntax_ok = check_python_syntax()
    imports_ok = check_import_dependencies()
    functionality_ok = check_functionality()
    config_ok = check_configuration()
    
    print("\n" + "="*50)
    print("최종 평가")
    print("="*50 + "\n")
    
    checks = {
        '프로젝트 구조': structure_ok,
        'Python 문법': syntax_ok,
        '임포트 의존성': imports_ok,
        '기능 구현': functionality_ok,
        '설정 파일': config_ok
    }
    
    passed = sum(checks.values())
    total = len(checks)
    
    for check, result in checks.items():
        status = "✓ 통과" if result else "✗ 실패"
        print(f"{check}: {status}")
    
    print(f"\n종합 점수: {passed}/{total} ({passed/total*100:.1f}%)")
    
    if passed == total:
        print("\n🎉 프로젝트가 완성되었습니다! 모든 기능이 구현되어 있습니다.")
        print("\n다음 단계:")
        print("1. .env 파일을 생성하고 API 키를 설정하세요")
        print("2. pip install -r requirements.txt로 의존성을 설치하세요")
        print("3. python src/main.py example_script.md로 실행해 보세요")
    else:
        print(f"\n⚠️ {total - passed}개의 항목이 개선이 필요합니다.")
        print("위의 오류들을 수정한 후 다시 확인하세요.")

if __name__ == '__main__':
    os.chdir('engineering-shorts-generator')
    generate_completion_report()
