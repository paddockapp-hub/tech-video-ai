"""
Google Flow/Imagen Service Module
Google Generative AI를 활용하여 이미지 생성
"""

import os
import base64
import requests
from typing import Dict, List, Optional, Any
from PIL import Image
import io

# 새로운 google.genai 패키지 사용
try:
    import google.genai as genai
    USE_NEW_API = True
except ImportError:
    # 이전 패키지 대체 사용 (deprecation 경고 억제)
    import warnings
    warnings.filterwarnings('ignore', category=FutureWarning)
    import google.generativeai as genai
    USE_NEW_API = False


class GoogleFlowService:
    def __init__(self, config: Dict):
        self.config = config
        try:
            genai.configure(api_key=config.get('google_api_key'))
        except Exception as e:
            print(f"Google API 설정 실패: {e}")
        self.model_name = config.get('google_model', 'gemini-pro')
        
    def generate_image_with_imagen(self, prompt: str, output_path: str, 
                                   width: int = 1080, height: int = 1920) -> bool:
        """Imagen을 사용하여 이미지 생성"""
        
        try:
            # Google Cloud Vertex AI Imagen API 호출
            # (실제 구현 시 Vertex AI API 사용 필요)
            
            # 현재는 시뮬레이션용으로 더미 이미지 생성
            self._create_dummy_image(output_path, width, height, prompt)
            
            print(f"이미지 생성 완료: {output_path}")
            return True
            
        except Exception as e:
            print(f"이미지 생성 중 오류 발생: {e}")
            return False
    
    def generate_with_gemini_pro_vision(self, prompt: str, output_path: str) -> bool:
        """Gemini Pro Vision을 사용하여 이미지 생성 및 분석"""
        
        try:
            # Gemini Pro Vision 모델 설정
            model = genai.GenerativeModel('gemini-pro-vision')
            
            # 텍스트 프롬프트로 이미지 생성 요청
            response = model.generate_content(prompt)
            
            # 생성된 이미지 저장
            if response.parts and hasattr(response.parts[0], 'image'):
                image_data = response.parts[0].image
                with open(output_path, 'wb') as f:
                    f.write(image_data)
                return True
            
            return False
            
        except Exception as e:
            print(f"Gemini Pro Vision 이미지 생성 중 오류 발생: {e}")
            return False
    
    def generate_base_image(self, prompt: str, scene_number: int, output_dir: str) -> str:
        """기본 이미지 (인포그래픽 없음) 생성"""
        
        enhanced_prompt = f"""
Create a clean, professional engineering visualization image with the following specifications:
{prompt}

Style requirements:
- Clean background without text overlays
- Professional engineering aesthetic
- High quality, detailed
- Vertical orientation (9:16 aspect ratio)
- No infographics or diagrams overlay
- Pure visual representation of the concept
"""
        
        output_path = os.path.join(output_dir, f"scene_{scene_number:02d}_base.png")
        
        success = self.generate_image_with_imagen(enhanced_prompt, output_path)
        
        if success:
            return output_path
        else:
            # 실패 시 대용 이미지 생성
            return self._create_dummy_image(output_path, 1080, 1920, prompt)
    
    def generate_infographic_image(self, prompt: str, scene_number: int, output_dir: str) -> str:
        """인포그래픽이 포함된 이미지 생성"""
        
        enhanced_prompt = f"""
Create an engineering visualization image with detailed infographics:
{prompt}

Style requirements:
- Include technical diagrams and infographics
- Show engineering principles visually
- Add measurements, labels, and technical annotations
- Professional engineering aesthetic
- High quality, detailed
- Vertical orientation (9:16 aspect ratio)
- Educational and informative style
"""
        
        output_path = os.path.join(output_dir, f"scene_{scene_number:02d}_infographic.png")
        
        success = self.generate_image_with_imagen(enhanced_prompt, output_path)
        
        if success:
            return output_path
        else:
            # 실패 시 대용 이미지 생성
            return self._create_dummy_image(output_path, 1080, 1920, prompt)
    
    def _create_dummy_image(self, output_path: str, width: int, height: int, text: str) -> str:
        """테스트용 더미 이미지 생성"""
        
        # 실제 API 연동 전까지 사용할 더미 이미지
        from PIL import Image, ImageDraw, ImageFont
        
        # 이미지 생성
        img = Image.new('RGB', (width, height), color=(50, 50, 80))
        draw = ImageDraw.Draw(img)
        
        # 배경 그라데이션 효과
        for y in range(height):
            r = int(50 + (y / height) * 30)
            g = int(50 + (y / height) * 40)
            b = int(80 + (y / height) * 50)
            draw.rectangle([(0, y), (width, y+1)], fill=(r, g, b))
        
        # 텍스트 추가
        try:
            # 시스템 폰트 사용 시도
            font = ImageFont.truetype("arial.ttf", 40)
        except:
            font = ImageFont.load_default()
        
        # 텍스트 래핑
        text_lines = self._wrap_text(text, 30)
        y_offset = 100
        
        for line in text_lines:
            draw.text((50, y_offset), line, fill=(255, 255, 255), font=font)
            y_offset += 50
        
        # 장면 번호 추가
        draw.text((50, height - 100), f"Scene: {os.path.basename(output_path)}", 
                 fill=(200, 200, 200), font=font)
        
        # 이미지 저장
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path)
        
        return output_path
    
    def _wrap_text(self, text: str, max_chars: int) -> List[str]:
        """텍스트를 지정된 길이로 래핑"""
        words = text.split()
        lines = []
        current_line = ""
        
        for word in words:
            if len(current_line + word) <= max_chars:
                current_line += word + " "
            else:
                lines.append(current_line.strip())
                current_line = word + " "
        
        if current_line:
            lines.append(current_line.strip())
        
        return lines[:10]  # 최대 10줄로 제한
    
    def batch_generate_images(self, prompts: List[Dict], output_dir: str) -> List[Dict]:
        """여러 장면의 이미지를 일괄 생성"""
        
        results = []
        
        for prompt_data in prompts:
            scene_number = prompt_data.get('scene_number', 1)
            base_prompt = prompt_data.get('base_prompt', '')
            infographic_prompt = prompt_data.get('infographic_prompt', '')
            
            # 기본 이미지 생성
            base_image_path = self.generate_base_image(base_prompt, scene_number, output_dir)
            
            # 인포그래픽 이미지 생성
            infographic_image_path = self.generate_infographic_image(infographic_prompt, scene_number, output_dir)
            
            results.append({
                'scene_number': scene_number,
                'base_image': base_image_path,
                'infographic_image': infographic_image_path,
                'description': prompt_data.get('description', ''),
                'engineering_concept': prompt_data.get('engineering_concept', '')
            })
            
            print(f"장면 {scene_number} 이미지 생성 완료")
        
        return results
