"""
Ollama Service Module
로컬에서 무료로 실행되는 Ollama AI 서비스
"""

import requests
import json
from typing import Dict, List, Any


class OllamaService:
    def __init__(self, host: str = "http://localhost:11434", model: str = "llama3.2"):
        self.host = host
        self.model = model
        self.api_url = f"{host}/api/generate"
        
    def check_connection(self) -> bool:
        """Ollama 서버 연결 확인"""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=5)
            if response.status_code == 200:
                print(f"   - Ollama 연결 성공")
                return True
            else:
                print(f"   - Ollama 연결 실패: 상태 코드 {response.status_code}")
                return False
        except requests.exceptions.Timeout:
            print(f"   - Ollama 연결 타임아웃")
            return False
        except requests.exceptions.ConnectionError:
            print(f"   - Ollama 연결 거부")
            return False
        except Exception as e:
            print(f"   - Ollama 연결 실패: {e}")
            return False
    
    def generate_text(self, prompt: str, model: str = None) -> str:
        """텍스트 생성"""
        
        if model is None:
            model = self.model
            
        try:
            response = requests.post(self.api_url, json={
                'model': model,
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.7,
                    'top_p': 0.9
                }
            }, timeout=300)  # 5분 타임아웃으로 증가
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', '')
            else:
                print(f"Ollama API 오류: {response.status_code}")
                return self._generate_fallback_response(prompt)
                
        except Exception as e:
            print(f"Ollama 텍스트 생성 중 오류: {e}")
            return self._generate_fallback_response(prompt)
    
    def analyze_script_for_images(self, script_text: str, num_keyframes: int) -> List[Dict]:
        """스크립트를 분석하여 이미지 프롬프트 생성"""
        
        prompt = f"""
You are an engineering visualization content creator. Analyze the following script and create image generation prompts for {num_keyframes} keyframes.

Script: {script_text}

For each keyframe, provide:
- scene_number: Scene number (1 to {num_keyframes})
- description: Detailed description of the scene
- base_prompt: Image generation prompt without infographics
- infographic_prompt: Image generation prompt with infographics
- visual_elements: Key visual elements to include
- engineering_concept: Engineering concept being explained

Respond in valid JSON array format only, no additional text:
[
  {{
    "scene_number": 1,
    "description": "...",
    "base_prompt": "...",
    "infographic_prompt": "...",
    "visual_elements": ["..."],
    "engineering_concept": "..."
  }}
]
"""
        
        try:
            response_text = self.generate_text(prompt)
            
            # JSON 파싱 시도
            # JSON 블록 추출
            json_start = response_text.find('[')
            json_end = response_text.rfind(']') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                result = json.loads(json_str)
                
                if isinstance(result, list):
                    return result
                elif isinstance(result, dict) and 'keyframes' in result:
                    return result['keyframes']
                else:
                    return [result]
            else:
                # JSON을 찾지 못한 경우 수동 파싱 시도
                return json.loads(response_text)
                
        except Exception as e:
            print(f"Ollama JSON 파싱 중 오류: {e}")
            print(f"원본 응답: {response_text[:200]}...")
            return self._generate_fallback_prompts(script_text, num_keyframes)
    
    def organize_clip_sequence(self, clips_info: List[Dict]) -> List[Dict]:
        """클립 순서 정리"""
        
        prompt = f"""
You are a video editing expert. Organize the following image clips in logical sequence.

Clip information: {json.dumps(clips_info, indent=2, ensure_ascii=False)}

Provide the organized sequence in JSON format:
{{
  "organized_clips": [
    {{
      "original_index": 0,
      "new_position": 0,
      "reason": "..."
    }}
  ]
}}
Respond with valid JSON only, no additional text.
"""
        
        try:
            response_text = self.generate_text(prompt)
            
            # JSON 파싱
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start != -1 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                result = json.loads(json_str)
                
                if 'organized_clips' in result:
                    return result['organized_clips']
            
            return clips_info
            
        except Exception as e:
            print(f"클립 순서 정리 중 오류: {e}")
            return clips_info
    
    def enhance_script(self, script_text: str) -> str:
        """스크립트 향상 제안"""
        
        prompt = f"""
Analyze the following script for engineering shorts production and provide improvement suggestions.

Script: {script_text}

Provide suggestions in the following format:
- Original script issues analysis
- Improved script version
- Visualization suggestions

Keep the response concise and practical.
"""
        
        try:
            return self.generate_text(prompt)
        except Exception as e:
            print(f"스크립트 향상 분석 중 오류: {e}")
            return script_text
    
    def _generate_fallback_response(self, prompt: str) -> str:
        """대체 응답 생성"""
        return f"AI service unavailable. Fallback response for: {prompt[:50]}..."
    
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
    
    def get_available_models(self) -> List[str]:
        """사용 가능한 모델 목록"""
        try:
            response = requests.get(f"{self.host}/api/tags")
            if response.status_code == 200:
                models = response.json().get('models', [])
                return [model['name'] for model in models]
            return []
        except Exception as e:
            print(f"모델 목록 가져오기 실패: {e}")
            return []
    
    def pull_model(self, model_name: str) -> bool:
        """모델 다운로드"""
        try:
            response = requests.post(f"{self.host}/api/pull", json={
                'name': model_name,
                'stream': False
            }, timeout=300)  # 5분 타임아웃
            
            return response.status_code == 200
        except Exception as e:
            print(f"모델 다운로드 실패: {e}")
            return False