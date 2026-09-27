"""
Engineering Shorts Generator Package
공학 쇼츠 자동 생성 시스템
"""

__version__ = "1.0.0"
__author__ = "Engineering Shorts Generator Team"

from .script_analyzer import ScriptAnalyzer
from .gpt_service import GPTService
from .google_flow_service import GoogleFlowService
from .keyframe_manager import KeyframeManager
from .image_workflow import ImageWorkflow
from .video_editor import VideoEditor
from .tts_service import TTSService

# 로컬 AI 서비스 (선택적)
try:
    from .ollama_service import OllamaService
    __all__ = [
        'ScriptAnalyzer',
        'GPTService', 
        'GoogleFlowService',
        'KeyframeManager',
        'ImageWorkflow',
        'VideoEditor',
        'TTSService',
        'OllamaService'
    ]
except ImportError:
    __all__ = [
        'ScriptAnalyzer',
        'GPTService',
        'GoogleFlowService', 
        'KeyframeManager',
        'ImageWorkflow',
        'VideoEditor',
        'TTSService'
    ]

try:
    from .stable_diffusion_service import StableDiffusionService
    __all__.append('StableDiffusionService')
except ImportError:
    pass
