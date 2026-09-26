"""
간단한 import 테스트 스크립트
모든 모듈이 올바르게 import되는지 확인
"""

import sys
import os

# src 디렉토리를 경로에 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

print("=== Module Import Test ===\n")

try:
    print("1. script_analyzer module test...")
    from script_analyzer import ScriptAnalyzer
    print("   [OK] ScriptAnalyzer import success")
except Exception as e:
    print(f"   [FAIL] ScriptAnalyzer import failed: {e}")

try:
    print("2. gpt_service module test...")
    from gpt_service import GPTService
    print("   [OK] GPTService import success")
except Exception as e:
    print(f"   [FAIL] GPTService import failed: {e}")

try:
    print("3. google_flow_service module test...")
    from google_flow_service import GoogleFlowService
    print("   [OK] GoogleFlowService import success")
except Exception as e:
    print(f"   [FAIL] GoogleFlowService import failed: {e}")

try:
    print("4. keyframe_manager module test...")
    from keyframe_manager import KeyframeManager
    print("   [OK] KeyframeManager import success")
except Exception as e:
    print(f"   [FAIL] KeyframeManager import failed: {e}")

try:
    print("5. image_workflow module test...")
    from image_workflow import ImageWorkflow
    print("   [OK] ImageWorkflow import success")
except Exception as e:
    print(f"   [FAIL] ImageWorkflow import failed: {e}")

try:
    print("6. video_editor module test...")
    from video_editor import VideoEditor
    print("   [OK] VideoEditor import success")
except Exception as e:
    print(f"   [FAIL] VideoEditor import failed: {e}")

try:
    print("7. tts_service module test...")
    from tts_service import TTSService
    print("   [OK] TTSService import success")
except Exception as e:
    print(f"   [FAIL] TTSService import failed: {e}")

try:
    print("8. main module test...")
    from main import EngineeringShortsGenerator
    print("   [OK] EngineeringShortsGenerator import success")
except Exception as e:
    print(f"   [FAIL] EngineeringShortsGenerator import failed: {e}")

print("\n=== Test Complete ===")
print("All modules imported successfully.")