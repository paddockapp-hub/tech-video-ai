"""
Script Analyzer Module
분석 MD 파일에서 스크립트를 읽고 키프레임 개수를 계산
"""

import re
from typing import Dict, List, Tuple


class ScriptAnalyzer:
    def __init__(self, config: Dict):
        self.config = config
        
    def parse_markdown_file(self, file_path: str) -> Dict:
        """마크다운 파일에서 스크립트 정보 추출"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
        except UnicodeDecodeError:
            raise UnicodeDecodeError("파일 인코딩 오류. UTF-8 인코딩을 확인해주세요.")
        except Exception as e:
            raise Exception(f"파일 읽기 중 오류 발생: {e}")
        
        # 제목 추출
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        title = title_match.group(1) if title_match else "Untitled"
        
        # 섹션별 텍스트 추출
        sections = re.split(r'^##\s+', content, flags=re.MULTILINE)
        sections = [s.strip() for s in sections if s.strip()]
        
        # 대본 텍스트 추출
        script_text = self._extract_script_text(content)
        
        # 음성 길이 추출 (초 단위)
        duration = self._extract_duration(content)
        
        return {
            'title': title,
            'content': content,
            'script_text': script_text,
            'duration': duration,
            'sections': sections
        }
    
    def _extract_script_text(self, content: str) -> str:
        """스크립트 텍스트 추출"""
        # 일반 텍스트 부분 추출 (코드 블록 제외)
        lines = content.split('\n')
        script_lines = []
        in_code_block = False
        
        for line in lines:
            if line.strip().startswith('```'):
                in_code_block = not in_code_block
                continue
            if not in_code_block and line.strip() and not line.strip().startswith('#'):
                script_lines.append(line.strip())
        
        return ' '.join(script_lines)
    
    def _extract_duration(self, content: str) -> int:
        """음성 길이 추출 (초 단위)"""
        # 파일에서 직접 명시된 경우
        duration_match = re.search(r'duration[:\s]+(\d+)', content, re.IGNORECASE)
        if duration_match:
            return int(duration_match.group(1))
        
        # 텍스트 길이로 추정 (한국어 기준 평균 300자/분)
        script_text = self._extract_script_text(content)
        char_count = len(script_text)
        estimated_duration = int(char_count / 5)  # 대략적인 추정
        
        return estimated_duration
    
    def calculate_keyframes(self, duration: int, scene_change_interval: int = 3) -> int:
        """키프레임 개수 계산"""
        # 기본적으로 3초마다 장면 전환
        keyframes = max(2, duration // scene_change_interval)
        return keyframes
    
    def extract_scene_segments(self, script_text: str, num_segments: int) -> List[str]:
        """스크립트를 장면 세그먼트로 분할"""
        words = script_text.split()
        segment_size = len(words) // num_segments
        
        segments = []
        for i in range(num_segments):
            start = i * segment_size
            end = start + segment_size if i < num_segments - 1 else len(words)
            segment = ' '.join(words[start:end])
            segments.append(segment)
        
        return segments
