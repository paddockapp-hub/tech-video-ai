"""
GPT Service Module
OpenAI GPT를 활용하여 스크립트 분석 및 이미지 프롬프트 생성
"""

import os
from typing import Dict, List, Any
from openai import OpenAI
import json


class GPTService:
    def __init__(self, config: Dict):
        self.config = config
        api_key = config.get('openai_api_key')
        self.client = OpenAI(api_key=api_key) if api_key else None
        self.model = config.get('openai_model', 'gpt-4')
        self.last_generation_source = 'none'
        self.last_analysis_source = 'none'
        
    def analyze_script_for_images(self, script_text: str, num_keyframes: int) -> List[Dict]:
        """스크립트를 분석하여 각 키프레임에 대한 이미지 프롬프트 생성"""
        
        prompt = f"""
다음 스크립트를 바탕으로 {num_keyframes}개의 키프레임 이미지를 생성하기 위한 프롬프트를 만들어주세요.

스크립트:
{script_text}

각 키프레임에 대해 다음 정보를 JSON 형식으로 제공해주세요:
- scene_number: 장면 번호 (1부터 {num_keyframes}까지)
- description: 장면에 대한 상세 설명
- base_prompt: 인포그래픽이 없는 기본 이미지 생성 프롬프트
- infographic_prompt: 인포그래픽이 포함된 이미지 생성 프롬프트
- visual_elements: 포함해야 할 주요 시각적 요소들
- engineering_concept: 이 장면이 설명하는 공학적 개념

응답은 반드시 유효한 JSON 배열 형식이어야 합니다.
"""
        
        try:
            if self.client is None:
                raise RuntimeError("OpenAI API key is not configured.")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "당신은 공학 시각화 콘텐츠 제작을 위한 프롬프트 엔지니어입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # 응답이 리스트 형식이 아니면 keyframes 필드 확인
            if isinstance(result, dict) and 'keyframes' in result:
                result = result['keyframes']
            elif isinstance(result, list):
                pass
            else:
                # 단일 객체인 경우 리스트로 변환
                result = [result]
            if not isinstance(result, list) or len(result) != num_keyframes:
                raise ValueError("GPT 응답의 키프레임 수가 요청과 일치하지 않습니다.")
            self.last_generation_source = 'openai'
            self.last_analysis_source = 'openai'
            return result
        except Exception:
            print(f"GPT API 호출 실패; fallback 프롬프트를 사용합니다.")
            self.last_generation_source = 'fallback'
            self.last_analysis_source = 'fallback'
            return self._generate_fallback_prompts(script_text, num_keyframes)
    
    def _generate_fallback_prompts(self, script_text: str, num_keyframes: int) -> List[Dict]:
        """GPT API 실패 시 대체 프롬프트 생성"""
        fallback_prompts = []
        
        for i in range(num_keyframes):
            fallback_prompts.append({
                "scene_number": i + 1,
                "description": f"Scene {i+1} for engineering visualization",
                "base_prompt": f"Engineering visualization scene {i+1}, clean background, professional style",
                "infographic_prompt": f"Engineering visualization scene {i+1} with detailed infographics and diagrams",
                "visual_elements": ["engineering elements", "technical diagrams"],
                "engineering_concept": "Engineering concept visualization",
                "source": "fallback"
            })
        
        return fallback_prompts
    
    def organize_clip_sequence(self, clips_info: List[Dict]) -> List[Dict]:
        """생성된 클립의 순서를 정리"""
        
        prompt = f"""
다음은 생성된 이미지 클립들의 정보입니다. 이를 논리적인 순서로 정리해주세요.

클립 정보:
{json.dumps(clips_info, indent=2, ensure_ascii=False)}

정리된 순서를 JSON 형식으로 제공해주세요:
- original_index: 원래 인덱스
- new_position: 새로운 위치
- reason: 순서 변경 이유
"""
        
        try:
            if self.client is None:
                self.last_generation_source = 'fallback'
                return clips_info
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "당신은 비디오 편집 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            organized = result.get('organized_clips') if isinstance(result, dict) else None
            if isinstance(organized, list) and organized:
                self.last_generation_source = 'openai'
                return organized
            self.last_generation_source = 'fallback'
            return clips_info
            
        except Exception as e:
            print("클립 순서 정리 실패; 입력 순서를 유지합니다.")
            self.last_generation_source = 'fallback'
            return clips_info
    
    def enhance_script(self, script_text: str) -> str:
        """스크립트를 향상시키기 위한 제안사항 생성"""
        
        prompt = f"""
다음 스크립트를 공학 쇼츠 제작에 적합하도록 분석하고 개선 제안을 해주세요.

스크립트:
{script_text}

다음 형식으로 제안해주세요:
- 원본 스크립트의 문제점 분석
- 개선된 스크립트 버전
- 시각화 제안사항
"""
        
        try:
            if self.client is None:
                return script_text
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "당신은 공학 콘텐츠 제작 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6
            )
            
            return response.choices[0].message.content
            
        except Exception:
            print("스크립트 향상 분석에 실패했습니다.")
            return script_text
