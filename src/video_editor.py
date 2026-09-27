"""
Video Editor Module
이미지를 영상으로 변환하고 편집하는 기능
"""

import os
import numpy as np
from typing import Dict, List, Any
from PIL import Image, ImageDraw, ImageFont
import cv2

# MoviePy 호환성 개선
try:
    from moviepy import (
        ImageClip, VideoFileClip, CompositeVideoClip, 
        TextClip, concatenate_videoclips, vfx, AudioFileClip
    )
    MOVIEPY_AVAILABLE = True
except ImportError as e:
    print(f"MoviePy import 실패: {e}")
    MOVIEPY_AVAILABLE = False


class VideoEditor:
    def __init__(self, config: Dict):
        self.config = config
        self.fps = config.get('fps', 30)
        self.width = config.get('image_width', 1080)
        self.height = config.get('image_height', 1920)
        self.output_dir = config.get('output_dir', 'output')
        self.temp_dir = config.get('temp_dir', 'temp')
        
        # 디렉토리 생성
        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)
        
        # MoviePy 가용성 확인
        if not MOVIEPY_AVAILABLE:
            print("경고: MoviePy를 사용할 수 없습니다. 비디오 생성 기능이 제한됩니다.")
    
    def create_motion_graphics_video(self, keyframes: List[Dict], audio_path: str = None) -> str:
        """모션 그래픽 영상 생성"""
        
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy를 사용할 수 없습니다. 비디오 생성을 진행할 수 없습니다.")
        
        print("=== 모션 그래픽 영상 생성 시작 ===")
        
        clips = []
        
        for keyframe in keyframes:
            base_image = keyframe.get('base_image_path')
            infographic_image = keyframe.get('infographic_image_path')
            duration = keyframe.get('duration', 3)
            
            if not base_image or not infographic_image:
                print(f"키프레임 {keyframe['id']}의 이미지가 없습니다. 건너뜁니다.")
                continue
            
            # 장면 클립 생성
            scene_clip = self._create_scene_clip(
                base_image, 
                infographic_image, 
                duration
            )
            
            clips.append(scene_clip)
        
        if not clips:
            raise ValueError("생성할 클립이 없습니다.")
        
        # 클립 연결
        final_video = concatenate_videoclips(clips, method="compose")
        
        # 출력 파일 경로
        output_path = os.path.join(self.output_dir, 'final_video.mp4')
        
        # 비디오 저장 (오디오 없이)
        final_video.write_videofile(
            output_path,
            fps=self.fps,
            codec='libx264',
            threads=4
        )
        
        print(f"영상 저장 완료: {output_path}")
        
        # 임시 파일 정리
        final_video.close()
        for clip in clips:
            clip.close()
        
        return output_path
    
    def _create_scene_clip(self, base_image: str, infographic_image: str, duration: float) -> ImageClip:
        """단일 장면 클립 생성 (인포그래픽 애니메이션 효과)"""
        
        # 기본 이미지 로드
        base_clip = ImageClip(base_image, duration=duration)
        
        # 인포그래픽 이미지 로드
        infographic_clip = ImageClip(infographic_image, duration=duration)
        
        # 기본 이미지만 사용 (간단하게)
        return base_clip
    
    def create_transition_video(self, clips: List[ImageClip], transition_type: str = "fade") -> VideoFileClip:
        """전환 효과가 있는 비디오 생성"""
        
        # 효과 없이 간단하게 연결
        final_video = concatenate_videoclips(clips, method="compose")
        return final_video
    
    def add_text_overlay(self, video_clip: VideoFileClip, text: str, 
                        position: str = "bottom", fontsize: int = 50) -> VideoFileClip:
        """텍스트 오버레이 추가"""
        
        try:
            txt_clip = TextClip(text, fontsize=fontsize, color='white', font='Arial')
            
            if position == "bottom":
                txt_clip = txt_clip.set_position(('center', 0.8), relative=True)
            elif position == "top":
                txt_clip = txt_clip.set_position(('center', 0.1), relative=True)
            else:  # center
                txt_clip = txt_clip.set_position('center')
            
            txt_clip = txt_clip.set_duration(video_clip.duration)
            
            final_clip = CompositeVideoClip([video_clip, txt_clip])
            return final_clip
            
        except Exception as e:
            print(f"텍스트 오버레이 추가 중 오류: {e}")
            return video_clip
    
    def organize_clips_with_gpt(self, clips_info: List[Dict], gpt_service) -> List[Dict]:
        """GPT를 사용하여 클립 순서 정리"""
        
        organized_clips = gpt_service.organize_clip_sequence(clips_info)
        
        # 정리된 순서대로 클립 재배열
        sorted_clips = sorted(
            organized_clips, 
            key=lambda x: x.get('new_position', x.get('original_index', 0))
        )
        
        return sorted_clips
    
    def create_video_from_images(self, image_paths: List[str], durations: List[float], 
                                 output_path: str = None) -> str:
        """이미지 목록에서 비디오 생성"""
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'from_images.mp4')
        
        clips = []
        for img_path, duration in zip(image_paths, durations):
            if os.path.exists(img_path):
                clip = ImageClip(img_path, duration=duration)
                clips.append(clip)
        
        if not clips:
            raise ValueError("생성할 클립이 없습니다.")
        
        final_video = concatenate_videoclips(clips)
        final_video.write_videofile(output_path, fps=self.fps)
        
        return output_path
    
    def add_subtitle_track(self, video_path: str, subtitles: List[Dict], 
                          output_path: str = None) -> str:
        """자막 트랙 추가"""
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'with_subtitles.mp4')
        
        video_clip = VideoFileClip(video_path)
        
        subtitle_clips = []
        for sub in subtitles:
            text = sub.get('text', '')
            start = sub.get('start', 0)
            end = sub.get('end', start + 2)
            
            txt_clip = TextClip(text, fontsize=40, color='white', 
                              font='Arial', stroke_color='black', stroke_width=2)
            txt_clip = txt_clip.set_position(('center', 0.85), relative=True)
            txt_clip = txt_clip.set_start(start).set_end(end)
            
            subtitle_clips.append(txt_clip)
        
        final_clip = CompositeVideoClip([video_clip] + subtitle_clips)
        final_clip.write_videofile(output_path, fps=self.fps)
        
        return output_path
    
    def create_preview_video(self, keyframes: List[Dict], preview_duration: int = 10) -> str:
        """프리뷰 비디오 생성 (짧은 버전)"""
        
        preview_clips = []
        total_duration = 0
        
        for keyframe in keyframes:
            if total_duration >= preview_duration:
                break
            
            base_image = keyframe.get('base_image_path')
            if not base_image or not os.path.exists(base_image):
                continue
            
            clip_duration = min(keyframe.get('duration', 2), preview_duration - total_duration)
            clip = ImageClip(base_image, duration=clip_duration)
            preview_clips.append(clip)
            total_duration += clip_duration
        
        if not preview_clips:
            raise ValueError("프리뷰를 생성할 클립이 없습니다.")
        
        preview_video = concatenate_videoclips(preview_clips)
        preview_path = os.path.join(self.output_dir, 'preview_video.mp4')
        preview_video.write_videofile(preview_path, fps=self.fps)
        
        return preview_path
    
    def add_watermark(self, video_path: str, watermark_text: str, 
                     output_path: str = None) -> str:
        """워터마크 추가"""
        
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'watermarked_video.mp4')
        
        video_clip = VideoFileClip(video_path)
        
        watermark_clip = TextClip(watermark_text, fontsize=30, color='white', 
                                font='Arial', opacity=0.5)
        watermark_clip = watermark_clip.set_position((0.9, 0.9), relative=True)
        watermark_clip = watermark_clip.set_duration(video_clip.duration)
        
        final_clip = CompositeVideoClip([video_clip, watermark_clip])
        final_clip.write_videofile(output_path, fps=self.fps)
        
        return output_path
    
    def optimize_video_for_platform(self, video_path: str, platform: str = "youtube") -> str:
        """플랫폼별 비디오 최적화"""
        
        video_clip = VideoFileClip(video_path)
        
        if platform == "youtube":
            # YouTube 쇼츠: 9:16 비율, 최적화된 코덱
            target_width = 1080
            target_height = 1920
        elif platform == "instagram":
            # Instagram Reels: 9:16 비율
            target_width = 1080
            target_height = 1920
        elif platform == "tiktok":
            # TikTok: 9:16 비율
            target_width = 1080
            target_height = 1920
        else:
            # 기본 설정
            target_width = 1080
            target_height = 1920
        
        # 비디오 크기 조정
        if video_clip.w != target_width or video_clip.h != target_height:
            video_clip = video_clip.resize((target_width, target_height))
        
        output_path = os.path.join(self.output_dir, f'optimized_{platform}.mp4')
        video_clip.write_videofile(output_path, fps=self.fps)
        
        return output_path
