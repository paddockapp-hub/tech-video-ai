"""
Stable Diffusion Service Module
로컬에서 무료로 실행되는 Stable Diffusion 이미지 생성 서비스
"""

import requests
import base64
import os
from typing import Dict, List, Optional
from PIL import Image
import io


class StableDiffusionService:
    def __init__(self, host: str = "http://127.0.0.1:7860"):
        self.host = host
        self.txt2img_url = f"{host}/sdapi/v1/txt2img"
        self.models_url = f"{host}/sdapi/v1/sd-models"
        
    def check_connection(self) -> bool:
        """Stable Diffusion 서버 연결 확인"""
        try:
            response = requests.get(f"{self.host}/sdapi/v1/sd-models", timeout=5)
            return response.status_code == 200
        except Exception as e:
            print(f"Stable Diffusion 연결 실패: {e}")
            return False
    
    def generate_image(self, prompt: str, output_path: str, 
                     negative_prompt: str = "",
                     width: int = 1080, height: int = 1920,
                     steps: int = 20, cfg_scale: float = 7.0) -> bool:
        """이미지 생성"""
        
        payload = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "steps": steps,
            "width": width,
            "height": height,
            "cfg_scale": cfg_scale,
            "sampler_name": "DPM++ 2M Karras"
        }
        
        try:
            response = requests.post(self.txt2img_url, json=payload, timeout=120)
            
            if response.status_code == 200:
                result = response.json()
                
                # 이미지 디코딩 및 저장
                image_data = base64.b64decode(result["images"][0])
                
                # 디렉토리 생성
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                with open(output_path, "wb") as f:
                    f.write(image_data)
                
                print(f"이미지 생성 완료: {output_path}")
                return True
            else:
                print(f"Stable Diffusion API 오류: {response.status_code}")
                return self._generate_dummy_image(output_path, prompt, width, height)
                
        except Exception as e:
            print(f"Stable Diffusion 이미지 생성 중 오류: {e}")
            return self._generate_dummy_image(output_path, prompt, width, height)
    
    def generate_base_image(self, prompt: str, scene_number: int, output_dir: str) -> str:
        """기본 이미지 생성 (인포그래픽 없음)"""
        
        enhanced_prompt = f"""
{prompt}

Style requirements:
- Clean background without text overlays
- Professional engineering aesthetic
- High quality, detailed
- Vertical orientation (9:16 aspect ratio)
- No infographics or diagrams overlay
- Pure visual representation of the concept
- Simple, clear design
"""
        
        negative_prompt = """
text, watermark, signature, infographics, diagrams, charts, 
graphs, labels, annotations, messy, cluttered, low quality
"""
        
        output_path = os.path.join(output_dir, f"scene_{scene_number:02d}_base.png")
        
        success = self.generate_image(
            enhanced_prompt, 
            output_path,
            negative_prompt=negative_prompt
        )
        
        if success:
            return output_path
        else:
            return self._generate_dummy_image(output_path, prompt, 1080, 1920)
    
    def generate_infographic_image(self, prompt: str, scene_number: int, output_dir: str) -> str:
        """인포그래픽 이미지 생성"""
        
        enhanced_prompt = f"""
{prompt}

Style requirements:
- Include technical diagrams and infographics
- Show engineering principles visually
- Add measurements, labels, and technical annotations
- Professional engineering aesthetic
- High quality, detailed
- Vertical orientation (9:16 aspect ratio)
- Educational and informative style
- Clear visual hierarchy
"""
        
        negative_prompt = """
text (except technical labels), watermark, signature, messy, 
cluttered, low quality, blurry, distorted
"""
        
        output_path = os.path.join(output_dir, f"scene_{scene_number:02d}_infographic.png")
        
        success = self.generate_image(
            enhanced_prompt,
            output_path,
            negative_prompt=negative_prompt
        )
        
        if success:
            return output_path
        else:
            return self._generate_dummy_image(output_path, prompt, 1080, 1920)
    
    def batch_generate_images(self, prompts: List[Dict], output_dir: str) -> List[Dict]:
        """일괄 이미지 생성"""
        
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
    
    def get_available_models(self) -> List[str]:
        """사용 가능한 모델 목록"""
        try:
            response = requests.get(self.models_url)
            if response.status_code == 200:
                models = response.json()
                return [model['title'] for model in models]
            return []
        except Exception as e:
            print(f"모델 목록 가져오기 실패: {e}")
            return []
    
    def set_model(self, model_name: str) -> bool:
        """모델 변경"""
        try:
            response = requests.post(f"{self.host}/sdapi/v1/options", json={
                "sd_model_checkpoint": model_name
            })
            return response.status_code == 200
        except Exception as e:
            print(f"모델 변경 실패: {e}")
            return False
    
    def _generate_dummy_image(self, output_path: str, text: str, width: int, height: int) -> str:
        """더미 이미지 생성 (폴백)"""
        
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
        draw.text((50, height - 100), f"Dummy: {os.path.basename(output_path)}", 
                 fill=(200, 200, 200), font=font)
        
        # 이미지 저장
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        img.save(output_path)
        
        return output_path
    
    def _wrap_text(self, text: str, max_chars: int) -> List[str]:
        """텍스트 래핑"""
        words = text.split()
        lines = []
        current_line = ""
        
        for word in words:
            if len(current_line + word) <= max_chars:
                current_line += word + " "
            else:
                if current_line:
                    lines.append(current_line.strip())
                current_line = word + " "
        
        if current_line:
            lines.append(current_line.strip())
        
        return lines[:10]  # 최대 10줄로 제한