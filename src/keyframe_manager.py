"""
Keyframe Manager Module
키프레임 계산, 관리 및 추적 기능
"""

import os
import json
from typing import Dict, List, Any
from datetime import datetime


class KeyframeManager:
    def __init__(self, config: Dict):
        self.config = config
        self.keyframes = []
        self.base_dir = config.get('output_dir', 'output')
        self.temp_dir = config.get('temp_dir', 'temp')
        
    def calculate_keyframes(self, script_analysis: Dict) -> Dict:
        """스크립트 분석 결과를 바탕으로 키프레임 계산"""
        
        duration = script_analysis.get('duration', 30)
        script_text = script_analysis.get('script_text', '')
        
        # 기본 설정
        scene_change_interval = 3  # 3초마다 장면 전환
        min_keyframes = 2
        max_keyframes = 15
        
        # 키프레임 개수 계산
        num_keyframes = max(min_keyframes, duration // scene_change_interval)
        num_keyframes = min(num_keyframes, max_keyframes)
        
        # 장면 세그먼트 분할
        scene_segments = self._divide_script_into_scenes(script_text, num_keyframes)
        
        # 각 키프레임 정보 생성
        keyframes = []
        for i, segment in enumerate(scene_segments):
            keyframe = {
                'id': i + 1,
                'scene_number': i + 1,
                'segment_text': segment,
                'duration': duration // num_keyframes,
                'start_time': i * (duration // num_keyframes),
                'end_time': (i + 1) * (duration // num_keyframes) if i < num_keyframes - 1 else duration,
                'base_image_path': None,
                'infographic_image_path': None,
                'status': 'pending',
                'created_at': None
            }
            keyframes.append(keyframe)
        
        self.keyframes = keyframes
        
        return {
            'total_keyframes': num_keyframes,
            'duration': duration,
            'keyframes': keyframes,
            'calculation_method': 'time_based',
            'scene_change_interval': scene_change_interval
        }
    
    def _divide_script_into_scenes(self, script_text: str, num_scenes: int) -> List[str]:
        """스크립트를 장면별로 분할"""
        
        # 문장 단위로 분할
        sentences = self._split_into_sentences(script_text)
        
        # 장면별 문장 배분
        scenes = []
        sentences_per_scene = max(1, len(sentences) // num_scenes)
        
        for i in range(num_scenes):
            start_idx = i * sentences_per_scene
            end_idx = start_idx + sentences_per_scene if i < num_scenes - 1 else len(sentences)
            scene_text = ' '.join(sentences[start_idx:end_idx])
            scenes.append(scene_text)
        
        return scenes
    
    def _split_into_sentences(self, text: str) -> List[str]:
        """텍스트를 문장 단위로 분할"""
        
        import re
        
        # 한국어와 영어 문장 분할
        sentences = re.split(r'(?<=[.!?])\s+(?=[^a-z])|(?<=[.!?])\s+', text)
        
        # 빈 문장 제거 및 공백 정리
        sentences = [s.strip() for s in sentences if s.strip()]
        
        return sentences
    
    def update_keyframe_status(self, keyframe_id: int, status: str, 
                               base_image_path: str = None, 
                               infographic_image_path: str = None):
        """키프레임 상태 업데이트"""
        
        for keyframe in self.keyframes:
            if keyframe['id'] == keyframe_id:
                keyframe['status'] = status
                if base_image_path:
                    keyframe['base_image_path'] = base_image_path
                if infographic_image_path:
                    keyframe['infographic_image_path'] = infographic_image_path
                keyframe['created_at'] = datetime.now().isoformat()
                break
    
    def get_keyframe_by_id(self, keyframe_id: int) -> Dict:
        """ID로 키프레임 조회"""
        
        for keyframe in self.keyframes:
            if keyframe['id'] == keyframe_id:
                return keyframe
        return None
    
    def get_pending_keyframes(self) -> List[Dict]:
        """대기 중인 키프레임 목록"""
        
        return [kf for kf in self.keyframes if kf['status'] == 'pending']
    
    def get_completed_keyframes(self) -> List[Dict]:
        """완료된 키프레임 목록"""
        
        return [kf for kf in self.keyframes if kf['status'] == 'completed']
    
    def get_progress_summary(self) -> Dict:
        """진행 상황 요약"""
        
        total = len(self.keyframes)
        completed = len(self.get_completed_keyframes())
        pending = len(self.get_pending_keyframes())
        in_progress = total - completed - pending
        
        return {
            'total': total,
            'completed': completed,
            'pending': pending,
            'in_progress': in_progress,
            'progress_percentage': (completed / total * 100) if total > 0 else 0
        }
    
    def save_keyframe_data(self, file_path: str = None):
        """키프레임 데이터를 파일로 저장"""
        
        if file_path is None:
            file_path = os.path.join(self.base_dir, 'keyframe_data.json')
        
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        data = {
            'keyframes': self.keyframes,
            'metadata': {
                'total_keyframes': len(self.keyframes),
                'created_at': datetime.now().isoformat(),
                'config': self.config
            }
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def load_keyframe_data(self, file_path: str = None):
        """파일에서 키프레임 데이터 로드"""
        
        if file_path is None:
            file_path = os.path.join(self.base_dir, 'keyframe_data.json')
        
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.keyframes = data.get('keyframes', [])
    
    def export_timeline(self, output_format: str = 'json') -> str:
        """타임라인 내보내기"""
        
        timeline_data = {
            'project_settings': {
                'duration': sum(kf['duration'] for kf in self.keyframes),
                'fps': self.config.get('fps', 30),
                'resolution': {
                    'width': self.config.get('image_width', 1080),
                    'height': self.config.get('image_height', 1920)
                }
            },
            'timeline': []
        }
        
        for keyframe in self.keyframes:
            timeline_item = {
                'scene_id': keyframe['id'],
                'start_time': keyframe['start_time'],
                'end_time': keyframe['end_time'],
                'duration': keyframe['duration'],
                'base_image': keyframe.get('base_image_path'),
                'infographic_image': keyframe.get('infographic_image_path'),
                'segment_text': keyframe['segment_text']
            }
            timeline_data['timeline'].append(timeline_item)
        
        if output_format == 'json':
            return json.dumps(timeline_data, indent=2, ensure_ascii=False)
        elif output_format == 'csv':
            return self._convert_to_csv(timeline_data)
        else:
            return json.dumps(timeline_data, indent=2, ensure_ascii=False)
    
    def _convert_to_csv(self, timeline_data: Dict) -> str:
        """CSV 형식으로 변환"""
        
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 헤더
        writer.writerow(['Scene_ID', 'Start_Time', 'End_Time', 'Duration', 
                        'Base_Image', 'Infographic_Image', 'Segment_Text'])
        
        # 데이터
        for item in timeline_data['timeline']:
            writer.writerow([
                item['scene_id'],
                item['start_time'],
                item['end_time'],
                item['duration'],
                item['base_image'],
                item['infographic_image'],
                item['segment_text']
            ])
        
        return output.getvalue()
