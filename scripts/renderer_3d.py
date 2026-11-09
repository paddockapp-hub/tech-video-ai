#!/usr/bin/env python3
"""
3D Visual Renderer - Three.js/Blender style 3D animations
- 메커니즘 3D 시각화
- 파티클 효과
- 카메라 애니메이션
"""
import json, math, time
from typing import Dict, List, Tuple
import numpy as np

class Vector3:
    def __init__(self, x=0, y=0, z=0):
        self.x, self.y, self.z = x, y, z

    def to_tuple(self):
        return (self.x, self.y, self.z)

class Camera:
    def __init__(self, position: Vector3, target: Vector3, fov=60):
        self.position = position
        self.target = target
        self.fov = fov

class Material:
    def __init__(self, color, roughness=0.5, metalness=0.0, emissive=None):
        self.color = color
        self.roughness = roughness
        self.metalness = metalness
        self.emissive = emissive

class Mesh:
    def __init__(self, geometry_type: str, material: Material, position: Vector3, rotation: Vector3, scale: Vector3):
        self.geometry_type = geometry_type  # 'sphere', 'box', 'cylinder', 'torus'
        self.material = material
        self.position = position
        self.rotation = rotation
        self.scale = scale

class AnimationKeyframe:
    def __init__(self, time: float, position: Vector3 = None, rotation: Vector3 = None, scale: Vector3 = None):
        self.time = time
        self.position = position
        self.rotation = rotation
        self.scale = scale

class Animation:
    def __init__(self, mesh: Mesh, keyframes: List[AnimationKeyframe]):
        self.mesh = mesh
        self.keyframes = sorted(keyframes, key=lambda k: k.time)

class Particle:
    def __init__(self, position: Vector3, velocity: Vector3, life: float, color, size: float):
        self.position = position
        self.velocity = velocity
        self.life = life
        self.max_life = life
        self.color = color
        self.size = size

class ParticleSystem:
    def __init__(self, max_particles=1000):
        self.particles: List[Particle] = []
        self.max_particles = max_particles

    def emit(self, position: Vector3, velocity: Vector3, life: float, color, size: float):
        if len(self.particles) < self.max_particles:
            self.particles.append(Particle(position, velocity, life, color, size))

    def update(self, dt: float):
        for p in self.particles[:]:
            p.life -= dt
            if p.life <= 0:
                self.particles.remove(p)
                continue
            p.position.x += p.velocity.x * dt
            p.position.y += p.velocity.y * dt
            p.position.z += p.velocity.z * dt

class Scene3D:
    def __init__(self):
        self.meshes: List[Mesh] = []
        self.animations: List[Animation] = []
        self.particle_systems: List[ParticleSystem] = []
        self.camera = Camera(Vector3(0, 0, 5), Vector3(0, 0, 0))
        self.lights = []

    def add_mesh(self, mesh: Mesh):
        self.meshes.append(mesh)

    def add_animation(self, animation: Animation):
        self.animations.append(animation)

    def add_particle_system(self, ps: ParticleSystem):
        self.particle_systems.append(ps)

    def update(self, time: float, dt: float):
        # 애니메이션 업데이트
        for anim in self.animations:
            keyframe_idx = 0
            for i, kf in enumerate(anim.keyframes):
                if time >= kf.time:
                    keyframe_idx = i
                else:
                    break

            if keyframe_idx < len(anim.keyframes) - 1:
                kf1 = anim.keyframes[keyframe_idx]
                kf2 = anim.keyframes[keyframe_idx + 1]
                t = (time - kf1.time) / (kf2.time - kf1.time) if kf2.time > kf1.time else 0

                if kf1.position and kf2.position:
                    anim.mesh.position.x = kf1.position.x + (kf2.position.x - kf1.position.x) * t
                    anim.mesh.position.y = kf1.position.y + (kf2.position.y - kf1.position.y) * t
                    anim.mesh.position.z = kf1.position.z + (kf2.position.z - kf1.position.z) * t

                if kf1.rotation and kf2.rotation:
                    anim.mesh.rotation.x = kf1.rotation.x + (kf2.rotation.x - kf1.rotation.x) * t
                    anim.mesh.rotation.y = kf1.rotation.y + (kf2.rotation.y - kf1.rotation.y) * t
                    anim.mesh.rotation.z = kf1.rotation.z + (kf2.rotation.z - kf1.rotation.z) * t

        # 파티클 업데이트
        for ps in self.particle_systems:
            ps.update(dt)

    def to_json(self):
        return {
            "camera": {
                "position": self.camera.position.to_tuple(),
                "target": self.camera.target.to_tuple(),
                "fov": self.camera.fov
            },
            "meshes": [
                {
                    "geometry": m.geometry_type,
                    "material": {
                        "color": m.material.color,
                        "roughness": m.material.roughness,
                        "metalness": m.material.metalness,
                        "emissive": m.material.emissive
                    },
                    "position": m.position.to_tuple(),
                    "rotation": m.rotation.to_tuple(),
                    "scale": m.scale.to_tuple()
                }
                for m in self.meshes
            ],
            "particles": [
                {
                    "position": p.position.to_tuple(),
                    "color": p.color,
                    "size": p.size,
                    "life": p.life / p.max_life
                }
                for ps in self.particle_systems
                for p in ps.particles
            ]
        }

def create_mechanism_scene(title: str, category: str) -> Scene3D:
    """
    주제에 맞는 3D 메커니즘 장면 생성
    """
    scene = Scene3D()

    # 카메라 설정
    scene.camera = Camera(Vector3(3, 2, 5), Vector3(0, 0, 0), fov=50)

    # 기본 구성요소
    base_material = Material((100, 150, 200), roughness=0.3, metalness=0.7)
    accent_material = Material((255, 200, 50), roughness=0.4, metalness=0.5)

    # 중심 코어
    core = Mesh("sphere", base_material, Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(1, 1, 1))
    scene.add_mesh(core)

    # 회전 링
    ring = Mesh("torus", accent_material, Vector3(0, 0, 0), Vector3(0, 0, 0), Vector3(1.5, 1.5, 1.5))
    scene.add_mesh(ring)

    # 회전 애니메이션
    ring_anim = Animation(ring, [
        AnimationKeyframe(0, rotation=Vector3(0, 0, 0)),
        AnimationKeyframe(5, rotation=Vector3(0, math.pi * 2, 0))
    ])
    scene.add_animation(ring_anim)

    # 궤도 입자들
    particle_system = ParticleSystem(max_particles=100)
    for i in range(12):
        angle = (i / 12) * math.pi * 2
        pos = Vector3(math.cos(angle) * 2, math.sin(angle) * 2, 0)
        vel = Vector3(-math.sin(angle) * 0.5, math.cos(angle) * 0.5, 0)
        particle_system.emit(pos, vel, 5, (255, 255, 200), 0.1)
    scene.add_particle_system(particle_system)

    return scene

if __name__ == "__main__":
    scene = create_mechanism_scene("비행기 원리", "engineering")
    scene.update(2.5, 0.016)
    print(json.dumps(scene.to_json(), indent=2))
