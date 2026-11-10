#!/usr/bin/env python3
"""
Enhanced 3D Video Renderer with True 3D Effects
- Multi-layer composition with depth
- Real 3D geometry transformations
- Particle systems with physics
- Camera movements
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math

class Camera3D:
    def __init__(self, position, target, fov=60):
        self.position = np.array(position)
        self.target = np.array(target)
        self.fov = fov

    def project(self, point_3d, width, height):
        """3D 점을 2D 화면 좌표로 투영"""
        x, y, z = point_3d
        
        # 카메라 공간으로 변환
        rel = point_3d - self.position
        dist = np.linalg.norm(rel)
        
        if dist == 0:
            return (width // 2, height // 2), 1.0
        
        # 원근법 투영
        focal_length = 500 / math.tan(math.radians(self.fov / 2))
        scale = focal_length / dist
        
        screen_x = width // 2 + int(rel[0] * scale)
        screen_y = height // 2 - int(rel[1] * scale)
        
        return (screen_x, screen_y), scale

class Object3D:
    def __init__(self, vertices, faces, position, rotation, color):
        self.vertices = np.array(vertices)
        self.faces = faces
        self.position = np.array(position)
        self.rotation = np.array(rotation)
        self.color = color

    def rotate(self, angles):
        """회전 행렬 적용"""
        rx, ry, rz = angles
        
        # X축 회전
        Rx = np.array([
            [1, 0, 0],
            [0, math.cos(rx), -math.sin(rx)],
            [0, math.sin(rx), math.cos(rx)]
        ])
        
        # Y축 회전
        Ry = np.array([
            [math.cos(ry), 0, math.sin(ry)],
            [0, 1, 0],
            [-math.sin(ry), 0, math.cos(ry)]
        ])
        
        # Z축 회전
        Rz = np.array([
            [math.cos(rz), -math.sin(rz), 0],
            [math.sin(rz), math.cos(rz), 0],
            [0, 0, 1]
        ])
        
        R = Rz @ Ry @ Rx
        self.vertices = self.vertices @ R.T

    def transform(self, translation):
        """이동 변환"""
        self.vertices += np.array(translation)

def create_sphere(center, radius, segments=20):
    """구 정점 생성"""
    vertices = []
    faces = []
    
    phi_steps = segments
    theta_steps = segments
    
    for i in range(phi_steps + 1):
        phi = math.pi * i / phi_steps
        for j in range(theta_steps):
            theta = 2 * math.pi * j / theta_steps
            
            x = center[0] + radius * math.sin(phi) * math.cos(theta)
            y = center[1] + radius * math.cos(phi)
            z = center[2] + radius * math.sin(phi) * math.sin(theta)
            
            vertices.append([x, y, z])
    
    # 면 생성 (단순화)
    for i in range(phi_steps):
        for j in range(theta_steps):
            a = i * theta_steps + j
            b = a + theta_steps
            c = (i + 1) * theta_steps + j
            d = c + theta_steps
            faces.append([a, b, c, d])
    
    return vertices, faces

def create_torus(center, major_radius, minor_radius, segments=30):
    """토러스 정점 생성"""
    vertices = []
    faces = []
    
    u_steps = segments
    v_steps = segments
    
    for i in range(u_steps):
        u = 2 * math.pi * i / u_steps
        for j in range(v_steps):
            v = 2 * math.pi * j / v_steps
            
            x = center[0] + (major_radius + minor_radius * math.cos(v)) * math.cos(u)
            y = center[1] + minor_radius * math.sin(v)
            z = center[2] + (major_radius + minor_radius * math.cos(v)) * math.sin(u)
            
            vertices.append([x, y, z])
    
    for i in range(u_steps):
        for j in range(v_steps):
            a = i * v_steps + j
            b = a + v_steps
            c = ((i + 1) % u_steps) * v_steps + j
            d = c + v_steps
            faces.append([a, b, c, d])
    
    return vertices, faces

def render_3d_scene(width, height, time, title, category):
    """진짜 3D 장면 렌더링"""
    img = Image.new("RGB", (width, height), (10, 14, 26))
    draw = ImageDraw.Draw(img)
    
    # 카메라 설정
    camera = Camera3D([0, 0, 500], [0, 0, 0], fov=60)
    
    # 카메라 움직임
    camera_angle = time * 0.5
    camera.position[0] = math.sin(camera_angle) * 100
    camera.position[1] = math.cos(camera_angle) * 50
    
    # 3D 객체들 생성
    objects = []
    
    # 중심 구
    sphere_verts, sphere_faces = create_sphere([0, 0, 0], 100, 16)
    sphere = Object3D(sphere_verts, sphere_faces, [0, 0, 0], [0, time, 0], (56, 189, 248))
    sphere.rotate([0, time * 2, 0])
    objects.append(sphere)
    
    # 궤도 토러스
    torus_verts, torus_faces = create_torus([0, 0, 0], 200, 30, 24)
    torus = Object3D(torus_verts, torus_faces, [0, 0, 0], [math.pi/2, time * 1.5, 0], (100, 200, 255))
    objects.append(torus)
    
    # 각 객체 렌더링
    for obj in objects:
        for face in obj.faces[:50]:  # 성능을 위해 면 제한
            face_verts = obj.vertices[face]
            
            # 3D 점들을 2D로 투영
            projected = []
            avg_z = 0
            for v in face_verts:
                (px, py), scale = camera.project(v, width, height)
                projected.append((px, py))
                avg_z += v[2]
            
            avg_z /= len(face_verts)
            
            # 깊이에 따른 투명도 및 색상
            depth_factor = max(0, min(1, (avg_z + 200) / 400))
            alpha = int(255 * depth_factor)
            
            # 면 그리기
            if len(projected) >= 3:
                try:
                    draw.polygon(projected, fill=(*obj.color, alpha))
                except:
                    pass
    
    # 3D 파티클 효과
    num_particles = 50
    for i in range(num_particles):
        angle = (i / num_particles) * 2 * math.pi + time
        radius = 250 + math.sin(time * 2 + i) * 50
        x = int(width // 2 + radius * math.cos(angle))
        y = int(height // 2 + radius * math.sin(angle) * 0.6)
        size = int(3 + math.sin(time * 3 + i) * 2)
        draw.ellipse([x-size, y-size, x+size, y+size], fill=(255, 255, 200))
    
    # 텍스트 레이어 (3D 깊이감)
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    
    try:
        font = ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 48)
        text_bbox = overlay_draw.textbbox((0, 0), title, font=font)
        tw = text_bbox[2] - text_bbox[0]
        tx = (width - tw) // 2
        ty = 150
        
        # 그림자
        overlay_draw.text((tx+3, ty+3), title, font=font, fill=(0, 0, 0, 150))
        overlay_draw.text((tx, ty), title, font=font, fill=(255, 255, 255, 255))
    except:
        pass
    
    img.paste(overlay, (0, 0), overlay)
    
    # 후처리 효과
    img = img.filter(ImageFilter.SHARPEN)
    img = ImageEnhance.Contrast(img).enhance(1.2)
    img = ImageEnhance.Brightness(img).enhance(1.1)
    
    return np.array(img)

if __name__ == "__main__":
    # 테스트
    result = render_3d_scene(1080, 1920, 2.5, "테스트 영상", "engineering")
    print(f"3D 렌더링 완료: {result.shape}")
