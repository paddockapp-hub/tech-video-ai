"""
Image Generation Workflow Module
GPT와 Google Flow를 통합한 이미지 생성 워크플로우
"""

import os
import sys
from typing import Dict, List

# 현재 디렉토리를 경로에 추가
sys.path.insert(0, os.path.dirname(__file__))

from script_analyzer import ScriptAnalyzer
from gpt_service import GPTService
from google_flow_service import GoogleFlowService
from keyframe_manager import KeyframeManager


class ImageWorkflow:
    def __init__(self, config: Dict, gpt_service=None, google_flow_service=None, keyframe_manager=None):
        self.config = config
        self.script_analyzer = ScriptAnalyzer(config)
        
        # 외부에서 전달된 서비스 사용 또는 새로 초기화
        self.gpt_service = gpt_service if gpt_service else GPTService(config)
        self.google_flow_service = google_flow_service if google_flow_service else GoogleFlowService(config)
        self.keyframe_manager = keyframe_manager if keyframe_manager else KeyframeManager(config)
        
        # 출력 디렉토리 설정
        self.base_output_dir = config.get('output_dir', 'output')
        self.images_dir = os.path.join(self.base_output_dir, 'images')
        os.makedirs(self.images_dir, exist_ok=True)
    
    def execute_full_workflow(self, script_file_path: str) -> Dict:
        """전체 이미지 생성 워크플로우 실행"""
        
        print("=== 이미지 생성 워크플로우 시작 ===")
        
        # 1단계: 스크립트 분석
        print("1단계: 스크립트 분석 중...")
        script_analysis = self.script_analyzer.parse_markdown_file(script_file_path)
        if not script_analysis.get('script_text', '').strip():
            raise ValueError("스크립트 본문이 비어 있습니다.")
        if script_analysis.get('duration', 0) <= 0:
            raise ValueError("영상 길이를 계산할 수 없습니다.")
        print(f"   - 제목: {script_analysis['title']}")
        print(f"   - 음성 길이: {script_analysis['duration']}초")
        
        # 2단계: 키프레임 계산
        print("2단계: 키프레임 계산 중...")
        keyframe_calculation = self.keyframe_manager.calculate_keyframes(script_analysis)
        num_keyframes = keyframe_calculation['total_keyframes']
        print(f"   - 필요한 키프레임 수: {num_keyframes}")
        
        # 3단계: 로컬 GPT로 프롬프트 생성
        print("3단계: 로컬 GPT로 이미지 프롬프트 생성 중...")
        
        # 로컬 GPT 사용 여부 확인
        try:
            if hasattr(self.gpt_service, 'check_connection'):
                print("   - Ollama 연결 확인 중...")
                connection_ok = self.gpt_service.check_connection()
                if connection_ok:
                    print("   - 로컬 GPT 사용")
                    image_prompts = self.gpt_service.analyze_script_for_images(
                        script_analysis['script_text'], 
                        num_keyframes
                    )
                else:
                    print("   - 로컬 GPT 연결 실패, 대체 프롬프트 사용")
                    image_prompts = self._generate_fallback_prompts(script_analysis['script_text'], num_keyframes)
                    self.gpt_service.last_analysis_source = 'fallback'
            else:
                print("   - GPT 서비스 사용")
                image_prompts = self.gpt_service.analyze_script_for_images(
                    script_analysis['script_text'], 
                    num_keyframes
                )
        except Exception:
            print("   - GPT 프롬프트 생성 실패")
            print("   - 대체 프롬프트 사용")
            image_prompts = self._generate_fallback_prompts(script_analysis['script_text'], num_keyframes)
            self.gpt_service.last_analysis_source = 'fallback'

        expected_scenes = list(range(1, num_keyframes + 1))
        prompt_scenes = [
            prompt.get('scene_number')
            for prompt in image_prompts
            if isinstance(prompt, dict)
        ] if isinstance(image_prompts, list) else []
        if (
            len(prompt_scenes) != len(expected_scenes)
            or any(type(scene) is not int for scene in prompt_scenes)
            or sorted(prompt_scenes) != expected_scenes
        ):
            image_prompts = self._generate_fallback_prompts(
                script_analysis['script_text'],
                num_keyframes,
            )
            self.gpt_service.last_analysis_source = 'fallback'
        
        print(f"   - 생성된 프롬프트 수: {len(image_prompts)}")
        
        # 4단계: 이미지 생성
        print("4단계: 이미지 생성 중...")
        generated_images = self.google_flow_service.batch_generate_images(
            image_prompts, 
            self.images_dir
        )
        if not isinstance(generated_images, list):
            raise RuntimeError("이미지 생성 서비스가 올바르지 않은 결과를 반환했습니다.")
        expected_scenes = {prompt.get('scene_number') for prompt in image_prompts}
        generated_scenes = {image.get('scene_number') for image in generated_images}
        image_paths = [
            image.get(path_key)
            for image in generated_images
            for path_key in ('base_image', 'infographic_image')
        ]
        image_files_valid = all(
            isinstance(path, str) and os.path.isfile(path) and os.path.getsize(path) > 0
            for path in image_paths
        )
        images_complete = (
            expected_scenes == generated_scenes
            and image_files_valid
            and len(generated_images) == len(image_prompts)
        )
        if not images_complete:
            raise RuntimeError("이미지 생성 서비스가 모든 장면의 유효한 이미지 파일을 반환하지 않았습니다.")
        
        # 5단계: 키프레임 정보 업데이트
        print("5단계: 키프레임 정보 업데이트 중...")
        for i, img_data in enumerate(generated_images):
            scene_number = img_data['scene_number']
            self.keyframe_manager.update_keyframe_status(
                scene_number,
                'completed' if img_data.get('source') == 'external' else 'fallback',
                img_data['base_image'],
                img_data['infographic_image']
            )
        
        # 6단계: 데이터 저장
        print("6단계: 데이터 저장 중...")
        self.keyframe_manager.save_keyframe_data()
        
        print("=== 이미지 생성 워크플로우 완료 ===")
        
        ai_source = getattr(self.gpt_service, 'last_analysis_source', 'unknown')
        image_source = (
            'external'
            if all(item.get('source') == 'external' for item in generated_images)
            else 'fallback'
        )
        fully_external = image_source == 'external' and ai_source in ('ollama', 'openai')
        return {
            'success': True,
            'status': 'completed' if fully_external else 'completed_with_fallback',
            'ai_source': ai_source,
            'image_source': image_source,
            'script_analysis': script_analysis,
            'keyframe_calculation': keyframe_calculation,
            'image_prompts': image_prompts,
            'generated_images': generated_images,
            'output_directory': self.images_dir
        }
    
    def generate_single_scene(self, script_segment: str, scene_number: int) -> Dict:
        """단일 장면 이미지 생성"""
        
        print(f"장면 {scene_number} 이미지 생성 중...")
        
        # GPT로 프롬프트 생성
        prompt_data = self.gpt_service.analyze_script_for_images(script_segment, 1)
        
        if prompt_data and len(prompt_data) > 0:
            prompt_data = prompt_data[0]
        else:
            # 대체 프롬프트
            prompt_data = {
                'scene_number': scene_number,
                'base_prompt': script_segment,
                'infographic_prompt': script_segment + " with infographics",
                'description': script_segment
            }
        
        # 이미지 생성
        base_image = self.google_flow_service.generate_base_image(
            prompt_data['base_prompt'],
            scene_number,
            self.images_dir
        )
        base_source = getattr(self.google_flow_service, 'last_generation_source', 'unknown')
        
        infographic_image = self.google_flow_service.generate_infographic_image(
            prompt_data['infographic_prompt'],
            scene_number,
            self.images_dir
        )
        infographic_source = getattr(self.google_flow_service, 'last_generation_source', 'unknown')
        image_source = (
            'external'
            if base_source == 'external' and infographic_source == 'external'
            else 'fallback'
        )

        return {
            'scene_number': scene_number,
            'base_image': base_image,
            'infographic_image': infographic_image,
            'source': image_source,
            'base_image_source': base_source,
            'infographic_image_source': infographic_source,
            'prompt_data': prompt_data
        }
    
    def regenerate_scene_images(self, scene_number: int, new_prompts: Dict = None) -> Dict:
        """특정 장면 이미지 재생성"""
        
        print(f"장면 {scene_number} 이미지 재생성 중...")
        
        # 기존 키프레임 정보 조회
        keyframe = self.keyframe_manager.get_keyframe_by_id(scene_number)
        
        if not keyframe:
            raise ValueError(f"키프레임 {scene_number}를 찾을 수 없습니다.")
        
        # 새 프롬프트가 제공되지 않으면 기존 세그먼트 사용
        if new_prompts is None:
            script_segment = keyframe['segment_text']
            new_prompts = self.gpt_service.analyze_script_for_images(script_segment, 1)[0]
        
        # 이미지 재생성
        base_image = self.google_flow_service.generate_base_image(
            new_prompts['base_prompt'],
            scene_number,
            self.images_dir
        )
        base_source = getattr(self.google_flow_service, 'last_generation_source', 'unknown')
        
        infographic_image = self.google_flow_service.generate_infographic_image(
            new_prompts['infographic_prompt'],
            scene_number,
            self.images_dir
        )
        infographic_source = getattr(self.google_flow_service, 'last_generation_source', 'unknown')
        image_source = (
            'external'
            if base_source == 'external' and infographic_source == 'external'
            else 'fallback'
        )
        
        # 키프레임 정보 업데이트
        self.keyframe_manager.update_keyframe_status(
            scene_number,
            'completed' if image_source == 'external' else 'fallback',
            base_image,
            infographic_image
        )
        
        return {
            'scene_number': scene_number,
            'base_image': base_image,
            'infographic_image': infographic_image,
            'source': image_source,
            'base_image_source': base_source,
            'infographic_image_source': infographic_source,
            'prompts': new_prompts
        }
    
    def batch_process_multiple_scripts(self, script_file_paths: List[str]) -> List[Dict]:
        """여러 스크립트 파일 일괄 처리"""
        
        results = []
        
        for script_path in script_file_paths:
            try:
                print(f"\n스크립트 처리 중: {script_path}")
                result = self.execute_full_workflow(script_path)
                results.append({
                    'script_path': script_path,
                    'success': True,
                    'result': result
                })
            except Exception as e:
                print(f"스크립트 처리 실패: {script_path}, 오류: {e}")
                results.append({
                    'script_path': script_path,
                    'success': False,
                    'error': str(e)
                })
        
        return results
    
    def get_workflow_summary(self) -> Dict:
        """워크플로우 진행 상황 요약"""
        
        progress = self.keyframe_manager.get_progress_summary()
        
        return {
            'total_keyframes': progress['total'],
            'completed_keyframes': progress['completed'],
            'pending_keyframes': progress['pending'],
            'progress_percentage': progress['progress_percentage'],
            'output_directory': self.images_dir,
            'timeline': self.keyframe_manager.export_timeline()
        }
    
    def export_image_manifest(self, output_file: str = None) -> str:
        """생성된 이미지 매니페스트 내보내기"""
        
        if output_file is None:
            output_file = os.path.join(self.base_output_dir, 'image_manifest.json')
        
        manifest = {
            'project_info': {
                'created_at': self.keyframe_manager.keyframes[0].get('created_at') if self.keyframe_manager.keyframes else None,
                'total_scenes': len(self.keyframe_manager.keyframes),
                'output_directory': self.images_dir
            },
            'scenes': []
        }
        
        for keyframe in self.keyframe_manager.keyframes:
            scene_info = {
                'scene_id': keyframe['id'],
                'base_image': keyframe.get('base_image_path'),
                'infographic_image': keyframe.get('infographic_image_path'),
                'segment_text': keyframe['segment_text'],
                'duration': keyframe['duration'],
                'status': keyframe['status']
            }
            manifest['scenes'].append(scene_info)
        
        import json
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        
        return output_file
    
    def _generate_fallback_prompts(self, script_text: str, num_keyframes: int) -> List[Dict]:
        """대체 프롬프트 생성"""
        fallback_prompts = []
        
        for i in range(num_keyframes):
            fallback_prompts.append({
                "scene_number": i + 1,
                "description": f"Scene {i+1} for engineering visualization",
                "base_prompt": f"Engineering visualization scene {i+1}, clean background, professional style",
                "infographic_prompt": f"Engineering visualization scene {i+1} with detailed infographics and diagrams",
                "visual_elements": ["engineering elements", "technical diagrams"],
                "engineering_concept": "Engineering concept visualization"
            })
        
        return fallback_prompts
