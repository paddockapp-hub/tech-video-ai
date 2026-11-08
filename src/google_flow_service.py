"""
Google Flow/Imagen Service Module
Google Generative AI를 활용하여 이미지 생성
"""

import os
import base64
import requests
import re
import math
import numpy as np
from typing import Dict, List, Optional, Any, Tuple
from PIL import Image
import io

try:
    from .env_utils import get_env_value, resolve_env_value
except ImportError:
    from env_utils import get_env_value, resolve_env_value

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
        self.last_generation_source = 'none'
        self.last_error = None
        self._provider_disabled_error = None
        self.model_name = config.get('google_model', 'gemini-pro')
        self.image_model_name = (
            resolve_env_value(config.get('google_image_model'))
            or get_env_value('GOOGLE_IMAGE_MODEL')
            or 'gemini-nano-banana-2.1'
        )
        
    def generate_image_with_imagen(self, prompt: str, output_path: str, 
                                   width: int = 1080, height: int = 1920) -> bool:
        """Generate an image through Gemini's native image-generation API."""
        api_key = (
            resolve_env_value(self.config.get('google_api_key'))
            or get_env_value('GOOGLE_API_KEY')
            or get_env_value('GEMINI_API_KEY')
        )
        if not api_key:
            self.last_generation_source = 'fallback'
            self.last_error = 'image-provider-not-configured'
            return False
        if self._provider_disabled_error:
            self.last_generation_source = 'fallback'
            self.last_error = self._provider_disabled_error
            return False

        request_prompt = (
            f'{prompt}\n\n'
            f'Create a portrait image with an aspect ratio close to {width}:{height}. '
            'Do not include a watermark or a title card.'
        )
        try:
            response = requests.post(
                'https://generativelanguage.googleapis.com/v1beta/interactions',
                headers={
                    'x-goog-api-key': api_key,
                    'Content-Type': 'application/json',
                    'Api-Revision': '2026-05-20',
                },
                json={
                    'model': self.image_model_name,
                    'input': [{'type': 'text', 'text': request_prompt}],
                },
                timeout=180,
            )
        except requests.Timeout:
            self.last_generation_source = 'fallback'
            self.last_error = 'image-provider-timeout'
            return False
        except requests.RequestException:
            self.last_generation_source = 'fallback'
            self.last_error = 'image-provider-unreachable'
            return False

        if response.status_code != 200:
            self.last_generation_source = 'fallback'
            if response.status_code in (401, 403):
                self.last_error = 'image-provider-unauthorized'
                self._provider_disabled_error = self.last_error
            elif response.status_code == 429:
                self.last_error = 'image-provider-rate-limited'
            elif response.status_code == 404:
                self.last_error = 'image-model-unavailable'
                self._provider_disabled_error = self.last_error
            elif response.status_code == 400:
                try:
                    error_payload = response.json()
                    if isinstance(error_payload, list) and error_payload:
                        error_payload = error_payload[0]
                    error_data = (
                        error_payload.get('error', {})
                        if isinstance(error_payload, dict)
                        else {}
                    )
                    invalid_key = (
                        isinstance(error_data, dict)
                        and 'api key not valid' in str(error_data.get('message', '')).lower()
                    )
                except (AttributeError, ValueError):
                    invalid_key = False
                self.last_error = (
                    'image-provider-unauthorized'
                    if invalid_key
                    else 'image-provider-rejected-request'
                )
                if invalid_key:
                    self._provider_disabled_error = self.last_error
            else:
                self.last_error = 'image-provider-error'
            return False

        try:
            payload = response.json()
            image_output = payload.get('output_image') if isinstance(payload, dict) else None
            image_data = image_output.get('data') if isinstance(image_output, dict) else None
            if not isinstance(image_data, str) or not image_data:
                raise ValueError('image missing')
            decoded = base64.b64decode(image_data, validate=True)
            with Image.open(io.BytesIO(decoded)) as image:
                image.verify()
            os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
            with open(output_path, 'wb') as image_file:
                image_file.write(decoded)
        except (ValueError, TypeError, KeyError, OSError):
            self.last_generation_source = 'fallback'
            self.last_error = 'image-invalid-response'
            return False

        self.last_generation_source = 'external'
        self.last_error = None
        return True
    
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
                if not image_data:
                    return False
                with open(output_path, 'wb') as f:
                    f.write(image_data)
                self.last_generation_source = 'external'
                self.last_error = None
                return True
            
            return False
            
        except Exception:
            print("Gemini Pro Vision 이미지 생성에 실패했습니다.")
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
            return self._create_local_illustration(output_path, 1080, 1920, prompt, infographic=False)
    
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
            return self._create_local_illustration(output_path, 1080, 1920, prompt, infographic=True)

    @staticmethod
    def _font(size: int):
        from PIL import ImageFont
        for path in (
            'C:/Windows/Fonts/malgun.ttf',
            'C:/Windows/Fonts/arial.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        ):
            if os.path.isfile(path):
                try:
                    return ImageFont.truetype(path, size)
                except OSError:
                    pass
        return ImageFont.load_default()

    @staticmethod
    def _arrow(draw, start: Tuple[int, int], end: Tuple[int, int], color, width=8):
        draw.line((start, end), fill=color, width=width)
        angle = math.atan2(end[1] - start[1], end[0] - start[0])
        length = max(14, width * 2)
        points = [end]
        for offset in (2.55, -2.55):
            points.append((
                int(end[0] + length * math.cos(angle + offset)),
                int(end[1] + length * math.sin(angle + offset)),
            ))
        draw.polygon(points, fill=color)

    @staticmethod
    def _wrap_for_image(text: str, max_chars: int) -> List[str]:
        words = re.sub(r'\s+', ' ', text).strip().split(' ')
        lines, current = [], ''
        for word in words:
            if not word:
                continue
            candidate = f'{current} {word}'.strip()
            if len(candidate) > max_chars and current:
                lines.append(current)
                current = word
            else:
                current = candidate
        if current:
            lines.append(current)
        return lines

    def _create_local_illustration(
        self,
        output_path: str,
        width: int,
        height: int,
        text: str,
        infographic: bool,
    ) -> str:
        """Render an honest, locally drawn engineering illustration when AI image generation is unavailable."""
        from PIL import ImageDraw

        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        image = Image.new('RGB', (width, height))
        vertical = np.linspace(0, 1, height, dtype=np.float32)[:, None]
        gradient = np.zeros((height, width, 3), dtype=np.uint8)
        gradient[:, :, 0] = (7 + vertical * 6).astype(np.uint8)
        gradient[:, :, 1] = (18 + vertical * 14).astype(np.uint8)
        gradient[:, :, 2] = (38 + vertical * 22).astype(np.uint8)
        image = Image.fromarray(gradient)

        draw = ImageDraw.Draw(image, 'RGBA')
        margin = max(36, width // 18)
        cyan = (56, 220, 245, 255)
        blue = (70, 135, 250, 255)
        yellow = (255, 202, 76, 255)
        pale = (221, 239, 251, 255)
        muted = (132, 170, 197, 255)
        for x in range(margin, width, max(36, width // 20)):
            draw.line((x, margin, x, height - margin), fill=(66, 122, 160, 30), width=1)
        for y in range(margin, height - margin, max(36, width // 20)):
            draw.line((margin, y, width - margin, y), fill=(66, 122, 160, 30), width=1)

        content_text = text.split('Style requirements:', 1)[0]
        content_lines = [line.strip() for line in content_text.splitlines() if line.strip()]
        if content_lines and content_lines[0].lower().startswith(('create ', 'design ', 'illustrate ', 'generate ')) and len(content_lines) > 1:
            content_lines = content_lines[1:]
        scene_focus = next(
            (
                re.sub(r'(?i)^scene focus:\s*', '', line.strip())
                for line in content_lines
                if re.match(r'(?i)^scene focus:\s*', line.strip())
            ),
            '',
        )
        title = scene_focus or next(
            (line.strip('-* ') for line in content_lines),
            'Engineering concept',
        )
        title = re.sub(
            r'(?i)^(visual subject|topic|subject|scene focus):\s*',
            '',
            title,
        )
        title = re.sub(r'(?i)^(create|design|illustrate|generate)\b[^:]*:\s*', '', title).strip()
        title_lines = self._wrap_for_image(title, max(14, width // 22))[:3]
        draw.text((margin, margin), 'ENGINEERING / VISUAL EXPLAINER', font=self._font(max(12, width // 40)), fill=cyan)
        title_y = margin + max(40, width // 19)
        for line in title_lines:
            draw.text((margin, title_y), line[:52], font=self._font(max(22, width // 16)), fill=pale)
            title_y += max(34, width // 13)

        subject = (scene_focus + ' ' + title).lower()
        center_x = width // 2
        center_y = int(height * 0.53)
        radius = int(width * 0.28)
        draw.ellipse(
            (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
            outline=(56, 220, 245, 110),
            width=max(2, width // 240),
        )
        draw.ellipse(
            (center_x - radius + 16, center_y - radius + 16, center_x + radius - 16, center_y + radius - 16),
            outline=(70, 135, 250, 90),
            width=2,
        )

        if any(word in subject for word in (
            'bridge', 'truss', 'girder', 'foundation', 'pier', 'span',
            '교량', '다리', '트러스', '거더', '교각', '기초',
        )):
            deck_y = center_y + int(width * 0.13)
            deck_left = center_x - int(width * 0.34)
            deck_right = center_x + int(width * 0.34)
            deck_depth = int(width * 0.055)
            focus_is_foundation = any(word in subject for word in (
                'foundation', 'pier', 'ground', 'soil', 'bedrock',
                '기초', '교각', '지반', '암반', '하중 경로',
            ))
            focus_is_beam = any(word in subject for word in (
                'beam', 'girder', 'bending', 'deflection',
                '보', '거더', '휨', '처짐',
            ))
            focus_is_traffic = any(word in subject for word in (
                'traffic', 'vehicle', 'truck', 'car', 'vehicle load',
                '교통', '차량', '자동차', '바퀴',
            ))
            focus_is_truss = any(word in subject for word in (
                'truss', 'triangle', 'compression', 'tension',
                '트러스', '삼각형', '압축', '인장',
            ))
            isometric_offset = int(width * 0.035)
            deck_thickness = int(width * 0.035)
            far_left = (deck_left, deck_y - deck_depth)
            far_right = (deck_right, deck_y - deck_depth)
            near_left = (deck_left + isometric_offset, deck_y)
            near_right = (deck_right + isometric_offset, deck_y)
            draw.polygon(
                (far_left, far_right, near_right, near_left),
                fill=(52, 132, 178, 255),
                outline=cyan,
            )
            draw.polygon(
                (
                    near_left,
                    near_right,
                    (near_right[0], near_right[1] + deck_thickness),
                    (near_left[0], near_left[1] + deck_thickness),
                ),
                fill=(22, 70, 108, 255),
                outline=cyan,
            )
            draw.polygon(
                (
                    far_right,
                    near_right,
                    (near_right[0], near_right[1] + deck_thickness),
                    (far_right[0], far_right[1] + deck_thickness),
                ),
                fill=(18, 54, 88, 255),
                outline=cyan,
            )
            draw.line(
                (near_left, near_right),
                fill=pale,
                width=max(4, width // 150),
            )
            support_y = center_y + int(width * 0.36)
            support_positions = (
                (center_x - int(width * 0.25), center_x + int(width * 0.25))
                if focus_is_beam
                else (center_x - int(width * 0.21), center_x + int(width * 0.21))
            )
            for support_x in support_positions:
                pier_depth = max(8, isometric_offset // 2)
                top_left = (support_x - int(width * 0.045), deck_y + int(width * 0.02))
                top_right = (support_x + int(width * 0.045), deck_y + int(width * 0.02))
                bottom_left = (support_x - int(width * 0.07), support_y)
                bottom_right = (support_x + int(width * 0.07), support_y)
                draw.polygon(
                    [
                        top_left,
                        top_right,
                        bottom_right,
                        bottom_left,
                    ],
                    fill=(35, 91, 135, 255),
                    outline=cyan,
                )
                draw.polygon(
                    (
                        top_right,
                        (top_right[0] + pier_depth, top_right[1] - pier_depth),
                        (bottom_right[0] + pier_depth, bottom_right[1] - pier_depth),
                        bottom_right,
                    ),
                    fill=(20, 58, 94, 255),
                    outline=cyan,
                )
                base_left = support_x - int(width * 0.12)
                base_right = support_x + int(width * 0.12)
                base_top = support_y
                base_bottom = support_y + int(width * 0.035)
                draw.rounded_rectangle(
                    (
                        base_left,
                        base_top,
                        base_right,
                        base_bottom,
                    ),
                    radius=max(4, width // 100),
                    fill=(39, 107, 151, 255),
                    outline=pale,
                )
                draw.polygon(
                    (
                        (base_right - 4, base_top + 2),
                        (base_right + pier_depth, base_top - pier_depth + 2),
                        (base_right + pier_depth, base_bottom - pier_depth),
                        (base_right - 4, base_bottom),
                    ),
                    fill=(18, 54, 88, 255),
                    outline=cyan,
                )

            if focus_is_truss:
                truss_points = []
                truss_count = 8
                for index in range(truss_count + 1):
                    x = deck_left + index * (deck_right - deck_left) // truss_count
                    y = deck_y - int(width * 0.16) if index % 2 == 0 else deck_y
                    truss_points.append((x, y))
                draw.line(
                    truss_points,
                    fill=(0, 180, 216, 240),
                    width=max(3, width // 240),
                )
                for index in range(truss_count):
                    left_point = truss_points[index]
                    right_point = truss_points[index + 1]
                    lower_x = (left_point[0] + right_point[0]) // 2
                    draw.line(
                        (left_point, (lower_x, deck_y), right_point),
                        fill=(70, 135, 250, 230),
                        width=max(2, width // 300),
                    )
                draw.text(
                    (center_x - int(width * 0.24), deck_y - int(width * 0.23)),
                    'TRIANGLES / SHARE THE LOAD',
                    font=self._font(max(12, width // 40)),
                    fill=yellow,
                )
            elif focus_is_foundation:
                soil_y = center_y + int(width * 0.30)
                draw.rectangle(
                    (deck_left - int(width * 0.04), soil_y, deck_right, height - margin),
                    fill=(13, 31, 49, 255),
                )
                for layer in range(3):
                    layer_y = soil_y + int(width * (0.08 + layer * 0.075))
                    draw.line(
                        (deck_left - int(width * 0.04), layer_y, deck_right, layer_y),
                        fill=(66 + layer * 12, 122 + layer * 8, 160 + layer * 5, 170),
                        width=max(2, width // 360),
                    )
                draw.line(
                    (deck_left - int(width * 0.04), soil_y, deck_right, soil_y),
                    fill=(255, 202, 76, 230),
                    width=max(3, width // 240),
                )
                for support_x in support_positions:
                    draw.rounded_rectangle(
                        (
                            support_x - int(width * 0.11),
                            support_y,
                            support_x + int(width * 0.11),
                            support_y + int(width * 0.055),
                        ),
                        radius=max(4, width // 120),
                        fill=(39, 107, 151, 255),
                        outline=yellow,
                        width=max(2, width // 360),
                    )
                    self._arrow(
                        draw,
                        (support_x, deck_y + int(width * 0.06)),
                        (support_x, soil_y + int(width * 0.11)),
                        cyan,
                        max(4, width // 220),
                    )
                draw.text(
                    (deck_left, soil_y + int(width * 0.22)),
                    'PIERS TRANSFER FORCE INTO THE SOIL',
                    font=self._font(max(12, width // 42)),
                    fill=pale,
                )
            elif focus_is_beam:
                midspan_y = deck_y + int(width * 0.095)
                draw.line(
                    [
                        (deck_left + int(width * 0.05), deck_y + int(width * 0.055)),
                        (center_x - int(width * 0.16), midspan_y),
                        (center_x, midspan_y + int(width * 0.022)),
                        (center_x + int(width * 0.16), midspan_y),
                        (deck_right - int(width * 0.05), deck_y + int(width * 0.055)),
                    ],
                    fill=yellow,
                    width=max(3, width // 180),
                )
                draw.text(
                    (center_x - int(width * 0.20), deck_y + int(width * 0.16)),
                    'BENDING  /  LOAD → SUPPORTS',
                    font=self._font(max(12, width // 40)),
                    fill=yellow,
                )
            elif not focus_is_traffic:
                arch_points = []
                for index in range(17):
                    ratio = index / 16
                    x = deck_left + int((deck_right - deck_left) * ratio)
                    y = deck_y + int(width * 0.22 * 4 * ratio * (1 - ratio))
                    arch_points.append((x, y))
                draw.line(
                    arch_points,
                    fill=(70, 135, 250, 230),
                    width=max(4, width // 180),
                )
                for index in range(1, 8):
                    ratio = index / 8
                    x = deck_left + int((deck_right - deck_left) * ratio)
                    arch_y = deck_y + int(width * 0.22 * 4 * ratio * (1 - ratio))
                    draw.line(
                        (x, deck_y + int(width * 0.045), x, arch_y),
                        fill=cyan,
                        width=max(2, width // 300),
                    )

            if focus_is_traffic:
                car_x = center_x - int(width * 0.12)
                car_y = deck_y - int(width * 0.085)
                draw.rounded_rectangle(
                    (
                        car_x - int(width * 0.10),
                        car_y - int(width * 0.055),
                        car_x + int(width * 0.11),
                        car_y + int(width * 0.015),
                    ),
                    radius=max(6, width // 60),
                    fill=(255, 202, 76, 255),
                    outline=pale,
                    width=max(2, width // 360),
                )
                draw.polygon(
                    [
                        (car_x - int(width * 0.055), car_y - int(width * 0.055)),
                        (car_x - int(width * 0.025), car_y - int(width * 0.105)),
                        (car_x + int(width * 0.055), car_y - int(width * 0.105)),
                        (car_x + int(width * 0.085), car_y - int(width * 0.055)),
                    ],
                    fill=(34, 102, 153, 255),
                    outline=cyan,
                )
                for wheel_x in (car_x - int(width * 0.055), car_x + int(width * 0.07)):
                    wheel_y = car_y + int(width * 0.018)
                    draw.ellipse(
                        (
                            wheel_x - int(width * 0.018),
                            wheel_y - int(width * 0.018),
                            wheel_x + int(width * 0.018),
                            wheel_y + int(width * 0.018),
                        ),
                        fill=(7, 18, 38, 255),
                        outline=pale,
                        width=max(2, width // 360),
                    )
                draw.text(
                    (center_x - int(width * 0.19), car_y - int(width * 0.16)),
                    'TRAFFIC LOAD',
                    font=self._font(max(12, width // 40)),
                    fill=yellow,
                )

            if focus_is_truss or focus_is_traffic:
                load_positions = (
                    (center_x - int(width * 0.24), center_x, center_x + int(width * 0.24))
                    if focus_is_truss
                    else (center_x,)
                )
            elif focus_is_beam:
                load_positions = (center_x - int(width * 0.12), center_x, center_x + int(width * 0.12))
            else:
                load_positions = (center_x - int(width * 0.24), center_x, center_x + int(width * 0.24))
            for load_x in load_positions:
                self._arrow(
                    draw,
                    (load_x, deck_y - int(width * 0.30)),
                    (load_x, deck_y - int(width * 0.055)),
                    yellow,
                    max(4, width // 220),
                )
            for support_x in support_positions:
                self._arrow(
                    draw,
                    (support_x, support_y + int(width * 0.13)),
                    (support_x, support_y + int(width * 0.045)),
                    cyan,
                    max(4, width // 220),
                )

            if focus_is_foundation:
                load_path = 'LOAD PATH  /  DECK → PIERS → GROUND'
            elif focus_is_truss:
                load_path = 'TRIANGULATED MEMBERS  /  LOAD SHARED'
            elif focus_is_beam:
                load_path = 'BEAM SPAN  /  BENDING → SUPPORTS'
            elif focus_is_traffic:
                load_path = 'TRAFFIC → DECK → BRIDGE SUPPORTS'
            else:
                load_path = 'ARCH BRIDGE  /  FORCE TO ABUTMENTS'
            draw.text(
                (center_x - int(width * 0.28), center_y - int(width * 0.30)),
                load_path,
                font=self._font(max(12, width // 40)),
                fill=yellow,
            )
            draw.line(
                (
                    center_x - int(width * 0.35),
                    support_y + int(width * 0.08),
                    center_x + int(width * 0.35),
                    support_y + int(width * 0.08),
                ),
                fill=(56, 220, 245, 180),
                width=max(2, width // 360),
            )
        elif any(word in subject for word in ('airplane', 'wing', '비행기', '날개', '양력')):
            wing = [
                (center_x - int(width * .32), center_y + int(width * .06)),
                (center_x - int(width * .13), center_y - int(width * .045)),
                (center_x + int(width * .31), center_y - int(width * .02)),
                (center_x + int(width * .11), center_y + int(width * .055)),
            ]
            draw.polygon(wing, fill=(28, 99, 145, 245), outline=cyan)
            for offset in (-110, -55, 55, 110):
                y = center_y + offset
                self._arrow(draw, (center_x - radius, y), (center_x + radius - 8, y - 10), cyan, max(3, width // 280))
            draw.text((center_x - radius, center_y - radius - 30), 'AIRFLOW', font=self._font(max(13, width // 36)), fill=cyan)
            draw.text((center_x + int(width * .08), center_y + int(width * .1)), 'LIFT', font=self._font(max(13, width // 36)), fill=yellow)
        elif any(word in subject for word in ('electric vehicle', 'ev ', '배터리', '전기차', '회생제동', 'braking')):
            car_y = center_y + int(width * .08)
            draw.rounded_rectangle(
                (center_x - int(width * .31), car_y - int(width * .12), center_x + int(width * .31), car_y + int(width * .05)),
                radius=width // 18,
                fill=(24, 83, 125, 245),
                outline=cyan,
                width=max(3, width // 220),
            )
            draw.polygon([
                (center_x - int(width * .17), car_y - int(width * .12)),
                (center_x - int(width * .08), car_y - int(width * .22)),
                (center_x + int(width * .13), car_y - int(width * .22)),
                (center_x + int(width * .22), car_y - int(width * .12)),
            ], fill=(24, 83, 125, 245), outline=cyan)
            for wheel_x in (center_x - int(width * .2), center_x + int(width * .2)):
                draw.ellipse((wheel_x - width // 18, car_y, wheel_x + width // 18, car_y + width // 9), fill=(7, 18, 38, 255), outline=pale, width=4)
            draw.rounded_rectangle((center_x - width // 12, car_y - int(width * .09), center_x + width // 12, car_y + int(width * .015)), radius=8, fill=(255, 202, 76, 225))
            self._arrow(draw, (center_x, car_y - int(width * .29)), (center_x, car_y - int(width * .13)), yellow, max(4, width // 220))
            draw.text((center_x - width // 9, car_y - int(width * .39)), 'ENERGY → BATTERY', font=self._font(max(12, width // 38)), fill=yellow)
        elif any(word in subject for word in ('superconduct', '마이스너', '초전도', 'magnetic levitation')):
            coil_top = center_y + int(width * .1)
            for index in range(5):
                left = center_x - int(width * .25) + index * int(width * .1)
                draw.arc((left, coil_top - int(width * .1), left + int(width * .14), coil_top + int(width * .16)), 5, 350, fill=cyan, width=max(4, width // 180))
            magnet_y = center_y - int(width * .13)
            draw.rounded_rectangle((center_x - width // 7, magnet_y - width // 14, center_x, magnet_y + width // 14), radius=8, fill=(247, 86, 102, 255))
            draw.rounded_rectangle((center_x, magnet_y - width // 14, center_x + width // 7, magnet_y + width // 14), radius=8, fill=(67, 144, 255, 255))
            self._arrow(draw, (center_x, magnet_y + width // 8), (center_x, coil_top - width // 12), yellow, max(4, width // 220))
            draw.text((center_x - width // 7, magnet_y - width // 7), 'LEVITATION', font=self._font(max(12, width // 36)), fill=yellow)
        elif any(word in subject for word in ('rocket', '로켓', '탈출 속도', '추력')):
            body = [
                (center_x, center_y - int(width * .29)),
                (center_x + int(width * .11), center_y - int(width * .03)),
                (center_x + int(width * .075), center_y + int(width * .16)),
                (center_x - int(width * .075), center_y + int(width * .16)),
                (center_x - int(width * .11), center_y - int(width * .03)),
            ]
            draw.polygon(body, fill=(34, 102, 153, 255), outline=cyan)
            draw.polygon([(center_x - int(width * .075), center_y + int(width * .16)), (center_x, center_y + int(width * .31)), (center_x + int(width * .075), center_y + int(width * .16))], fill=(255, 163, 57, 245))
            self._arrow(draw, (center_x + int(width * .25), center_y + int(width * .12)), (center_x + int(width * .25), center_y - int(width * .23)), yellow, max(4, width // 220))
            draw.text((center_x - int(width * .31), center_y - int(width * .22)), 'THRUST', font=self._font(max(12, width // 36)), fill=yellow)
        else:
            draw.text(
                (center_x, center_y - int(width * 0.27)),
                'HOW THE SYSTEM WORKS',
                font=self._font(max(14, width // 32)),
                fill=cyan,
                anchor='mm',
            )
            words = title.split()
            flow_steps = []
            for index in range(3):
                start = index * len(words) // 3
                end = max(start + 1, (index + 1) * len(words) // 3)
                flow_steps.append(' '.join(words[start:end]) if words else 'Engineering system')

            node_height = max(68, width // 5)
            node_width = width - 2 * margin - max(24, width // 12)
            node_left = (width - node_width) // 2
            node_gap = max(24, width // 20)
            first_y = center_y - node_height - node_gap
            stage_labels = ('INPUT', 'TRANSFER', 'RESULT')
            stage_colors = (cyan, blue, yellow)
            for index, (step_text, stage, color) in enumerate(
                zip(flow_steps, stage_labels, stage_colors)
            ):
                top = first_y + index * (node_height + node_gap)
                draw.rounded_rectangle(
                    (node_left, top, node_left + node_width, top + node_height),
                    radius=max(10, width // 36),
                    fill=(12, 35, 60, 245),
                    outline=(color[0], color[1], color[2], 220),
                    width=max(2, width // 240),
                )
                badge_radius = max(15, width // 28)
                badge_x = node_left + badge_radius + max(14, width // 38)
                badge_y = top + node_height // 2
                draw.ellipse(
                    (
                        badge_x - badge_radius,
                        badge_y - badge_radius,
                        badge_x + badge_radius,
                        badge_y + badge_radius,
                    ),
                    fill=(color[0], color[1], color[2], 45),
                    outline=color,
                    width=max(2, width // 300),
                )
                draw.text(
                    (badge_x, badge_y),
                    f'{index + 1:02d}',
                    font=self._font(max(12, width // 40)),
                    fill=color,
                    anchor='mm',
                )
                text_x = node_left + badge_radius * 2 + max(24, width // 24)
                draw.text(
                    (text_x, top + max(8, width // 55)),
                    stage,
                    font=self._font(max(10, width // 48)),
                    fill=color,
                )
                detail_lines = self._wrap_for_image(
                    step_text,
                    max(12, int((node_width - (text_x - node_left) - 16) / max(10, width / 60))),
                )[:2]
                for line_index, line in enumerate(detail_lines):
                    draw.text(
                        (
                            text_x,
                            top + max(29, width // 28) + line_index * max(16, width // 38),
                        ),
                        line,
                        font=self._font(max(12, width // 38)),
                        fill=pale,
                    )
                if index < 2:
                    arrow_x = center_x
                    arrow_start = (arrow_x, top + node_height + 2)
                    arrow_end = (arrow_x, top + node_height + node_gap - 3)
                    self._arrow(draw, arrow_start, arrow_end, yellow, max(3, width // 300))

        if infographic:
            card_top = int(height * .77)
            card_height = int(height * .13)
            draw.rounded_rectangle(
                (margin, card_top, width - margin, card_top + card_height),
                radius=max(12, width // 36),
                fill=(10, 31, 56, 235),
                outline=(56, 220, 245, 160),
                width=2,
            )
            details = [line for line in self._wrap_for_image(text, max(20, width // 24)) if line][:3]
            for index, line in enumerate(details):
                y = card_top + max(20, width // 30) + index * max(24, width // 24)
                draw.ellipse((margin + 18, y + 5, margin + 30, y + 17), fill=yellow if index == 0 else cyan)
                draw.text((margin + 44, y), line[:48], font=self._font(max(13, width // 38)), fill=pale if index == 0 else muted)

        footer = 'LOCAL DIAGRAM • NOT AI-GENERATED IMAGE'
        draw.text(
            (margin, height - margin - max(20, width // 28)),
            footer,
            font=self._font(max(10, width // 48)),
            fill=(132, 170, 197, 230),
        )
        image.save(output_path, format='PNG', optimize=True)
        self.last_generation_source = 'local-renderer'
        self.last_error = self.last_error or 'image-provider-not-configured'
        return output_path
    
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
            base_image_source = self.last_generation_source
            
            # 인포그래픽 이미지 생성
            infographic_image_path = self.generate_infographic_image(infographic_prompt, scene_number, output_dir)
            infographic_image_source = self.last_generation_source
            scene_source = (
                'external'
                if base_image_source == 'external' and infographic_image_source == 'external'
                else (
                    'local-renderer'
                    if base_image_source == infographic_image_source == 'local-renderer'
                    else 'fallback'
                )
            )
            self.last_generation_source = scene_source
            
            results.append({
                'scene_number': scene_number,
                'base_image': base_image_path,
                'infographic_image': infographic_image_path,
                'source': scene_source,
                'base_image_source': base_image_source,
                'infographic_image_source': infographic_image_source,
                'description': prompt_data.get('description', ''),
                'engineering_concept': prompt_data.get('engineering_concept', '')
            })
            
            print(f"장면 {scene_number} 이미지 생성 완료")
        
        return results
