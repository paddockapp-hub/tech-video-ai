"""
Video Editor Module
이미지를 영상으로 변환하고 편집하는 기능
"""

import os
import json
import shutil
import subprocess
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
        scene_inputs = []
        for keyframe in keyframes:
            base_image = keyframe.get('base_image_path')
            infographic_image = keyframe.get('infographic_image_path')
            duration = keyframe.get('duration', 3)
            if not isinstance(duration, (int, float)) or duration <= 0:
                raise ValueError(f"키프레임 {keyframe.get('id')}의 재생 시간이 올바르지 않습니다.")
            
            if not base_image or not os.path.isfile(base_image):
                raise ValueError(f"키프레임 {keyframe.get('id')}의 기본 이미지가 없습니다.")
            if not infographic_image or not os.path.isfile(infographic_image):
                raise ValueError(f"키프레임 {keyframe.get('id')}의 인포그래픽 이미지가 없습니다.")
            scene_inputs.append((base_image, infographic_image, float(duration)))

        if not scene_inputs:
            raise ValueError("생성할 클립이 없습니다.")

        if audio_path:
            audio_duration = self._get_audio_duration(audio_path)
            scene_duration = sum(scene[2] for scene in scene_inputs)
            if audio_duration > scene_duration:
                base_image, infographic_image, duration = scene_inputs[-1]
                scene_inputs[-1] = (
                    base_image,
                    infographic_image,
                    duration + audio_duration - scene_duration,
                )

        output_path = os.path.join(self.output_dir, 'final_video.mp4')
        ffmpeg = self._find_ffmpeg()
        if ffmpeg:
            self._create_with_ffmpeg(scene_inputs, audio_path, output_path, ffmpeg)
            return output_path
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("FFmpeg와 MoviePy를 사용할 수 없어 비디오를 생성할 수 없습니다.")

        return self._create_with_moviepy(scene_inputs, audio_path, output_path)

    @staticmethod
    def _find_ffmpeg() -> str:
        ffmpeg = shutil.which('ffmpeg')
        if ffmpeg:
            return ffmpeg
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except (ImportError, RuntimeError):
            return ''

    @staticmethod
    def _get_audio_duration(audio_path: str) -> float:
        if not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
            raise FileNotFoundError("생성된 음성 파일을 찾을 수 없거나 비어 있습니다.")
        if MOVIEPY_AVAILABLE:
            audio_clip = AudioFileClip(audio_path)
            try:
                duration = float(audio_clip.duration or 0)
            finally:
                audio_clip.close()
        else:
            import re

            ffmpeg = VideoEditor._find_ffmpeg()
            if not ffmpeg:
                raise RuntimeError("음성 길이를 확인할 FFmpeg를 찾을 수 없습니다.")
            result = subprocess.run(
                [
                    ffmpeg, '-hide_banner', '-i', audio_path,
                    '-map', '0:a:0', '-f', 'null', '-',
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            output = result.stderr or ''
            match = re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)', output)
            if not match:
                raise RuntimeError("음성 길이를 확인할 수 없습니다.")
            duration = (
                int(match.group(1)) * 3600
                + int(match.group(2)) * 60
                + float(match.group(3))
            )

        if duration <= 0:
            raise RuntimeError("생성된 음성 파일의 길이가 올바르지 않습니다.")
        return duration

    def _create_with_ffmpeg(self, scenes, audio_path: str, output_path: str, ffmpeg: str) -> None:
        width = int(self.width)
        height = int(self.height)
        fps = int(self.fps)
        durations = [scene[2] for scene in scenes]
        total_duration = sum(durations)
        command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y']
        filters = []

        for index, (base_image, infographic_image, duration) in enumerate(scenes):
            input_duration = duration + (1 / fps)
            command.extend([
                '-loop', '1', '-framerate', str(fps), '-t', str(input_duration), '-i', base_image,
                '-loop', '1', '-framerate', str(fps), '-t', str(input_duration), '-i', infographic_image,
            ])
            base_index = index * 2
            overlay_index = base_index + 1
            filters.extend([
                f'[{base_index}:v]scale={width}:{height}:force_original_aspect_ratio=increase,'
                f'crop={width}:{height},setsar=1,fps={fps},format=yuv420p[base{index}]',
                f'[{overlay_index}:v]scale={width}:{height}:force_original_aspect_ratio=increase,'
                f'crop={width}:{height},setsar=1,fps={fps},format=rgba,'
                f'colorchannelmixer=aa=0.45[overlay{index}]',
                f'[base{index}][overlay{index}]overlay=0:0:shortest=1,'
                f'trim=duration={duration},setpts=PTS-STARTPTS,format=yuv420p[scene{index}]',
            ])

        require_audio = bool(audio_path)
        if audio_path:
            if not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                raise FileNotFoundError("생성된 음성 파일을 찾을 수 없거나 비어 있습니다.")
            audio_index = len(scenes) * 2
            command.extend(['-i', audio_path])

        scene_labels = ''.join(f'[scene{index}]' for index in range(len(scenes)))
        filters.append(f'{scene_labels}concat=n={len(scenes)}:v=1:a=0[video]')
        command.extend(['-filter_complex', ';'.join(filters), '-map', '[video]'])
        if audio_path:
            command.extend(['-map', f'{audio_index}:a:0', '-c:a', 'aac', '-b:a', '192k'])
        else:
            command.append('-an')

        command.extend([
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', str(fps),
            '-t', str(total_duration), '-movflags', '+faststart', output_path,
        ])
        result = subprocess.run(command, capture_output=True, text=True, check=False)
        if result.returncode != 0:
            raise RuntimeError("FFmpeg가 비디오 생성을 완료하지 못했습니다.")
        self._validate_video(output_path, require_audio=require_audio)

    def _create_with_moviepy(self, scenes, audio_path: str, output_path: str) -> str:
        clips = []
        audio_clip = None
        final_video = None
        print("=== 모션 그래픽 영상 생성 시작 (MoviePy fallback) ===")
        try:
            if audio_path:
                audio_duration = self._get_audio_duration(audio_path)
                clip_duration = sum(scene[2] for scene in scenes)
                if audio_duration > clip_duration:
                    base_image, infographic_image, duration = scenes[-1]
                    scenes[-1] = (
                        base_image,
                        infographic_image,
                        duration + audio_duration - clip_duration,
                    )
            for base_image, infographic_image, duration in scenes:
                clips.append(self._create_scene_clip(base_image, infographic_image, duration))

            final_video = concatenate_videoclips(clips, method="compose")
            if audio_path:
                if not os.path.isfile(audio_path):
                    raise FileNotFoundError("생성된 음성 파일을 찾을 수 없습니다.")
                audio_clip = AudioFileClip(audio_path)
                if not audio_clip.duration or audio_clip.duration <= 0:
                    raise ValueError("생성된 음성 파일의 길이가 올바르지 않습니다.")
                if hasattr(final_video, "with_audio"):
                    final_video = final_video.with_audio(audio_clip)
                else:
                    final_video = final_video.set_audio(audio_clip)

            write_options = {'fps': self.fps, 'codec': 'libx264', 'threads': 4}
            if audio_clip:
                write_options['audio_codec'] = 'aac'
            final_video.write_videofile(output_path, **write_options)
            self._validate_video(output_path, require_audio=bool(audio_path))
            print(f"영상 저장 완료: {output_path}")
            return output_path
        finally:
            if final_video is not None:
                final_video.close()
            if audio_clip is not None:
                audio_clip.close()
            for clip in clips:
                clip.close()
    
    def _create_scene_clip(self, base_image: str, infographic_image: str, duration: float) -> CompositeVideoClip:
        """단일 장면 클립 생성 (인포그래픽 애니메이션 효과)"""
        
        base_clip = ImageClip(base_image, duration=duration)
        infographic_clip = ImageClip(infographic_image, duration=duration)
        if hasattr(infographic_clip, "with_opacity"):
            infographic_clip = infographic_clip.with_opacity(0.45)
        else:
            infographic_clip = infographic_clip.set_opacity(0.45)
        return CompositeVideoClip([base_clip, infographic_clip], size=base_clip.size)
    
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
        organized = gpt_service.organize_clip_sequence(clips_info)
        if not isinstance(organized, list):
            gpt_service.last_generation_source = 'fallback'
            return clips_info
        positions = {}
        for item in organized:
            if not isinstance(item, dict):
                continue
            original_index = item.get('original_index')
            new_position = item.get('new_position')
            if (
                isinstance(original_index, int)
                and 0 <= original_index < len(clips_info)
                and isinstance(new_position, int)
            ):
                positions[original_index] = new_position
        if not positions:
            gpt_service.last_generation_source = 'fallback'
            return clips_info
        if (
            len(positions) != len(clips_info)
            or len(set(positions.values())) != len(clips_info)
        ):
            gpt_service.last_generation_source = 'fallback'
            return clips_info
        return [clips_info[index] for index in sorted(positions, key=positions.get)]

    @staticmethod
    def _validate_video(video_path: str, require_audio: bool = False) -> None:
        if not os.path.isfile(video_path) or os.path.getsize(video_path) == 0:
            raise RuntimeError("비디오 인코더가 유효한 출력 파일을 만들지 않았습니다.")
        with open(video_path, 'rb') as video_file:
            header = video_file.read(12)
        if len(header) < 8 or header[4:8] != b'ftyp':
            raise RuntimeError("생성된 파일의 MP4 컨테이너 signature가 올바르지 않습니다.")
        ffprobe = shutil.which('ffprobe')
        if ffprobe:
            probe = subprocess.run(
                [
                    ffprobe, '-v', 'error', '-show_entries',
                    'format=format_name,duration:stream=codec_type,codec_name,width,height',
                    '-of', 'json', video_path,
                ],
                capture_output=True,
                text=True,
                check=False,
            )
            if probe.returncode != 0:
                raise RuntimeError("생성된 MP4의 컨테이너/스트림 검증에 실패했습니다.")
            try:
                metadata = json.loads(probe.stdout)
            except ValueError as exc:
                raise RuntimeError("생성된 MP4의 검사 응답을 해석할 수 없습니다.") from exc
            streams = metadata.get('streams', [])
            video_streams = [
                stream for stream in streams
                if stream.get('codec_type') == 'video'
                and stream.get('codec_name') == 'h264'
                and stream.get('width', 0) > 0
                and stream.get('height', 0) > 0
            ]
            audio_streams = [
                stream for stream in streams
                if stream.get('codec_type') == 'audio'
                and stream.get('codec_name') == 'aac'
            ]
            container = metadata.get('format', {}).get('format_name', '')
            try:
                duration = float(metadata.get('format', {}).get('duration', 0))
            except (TypeError, ValueError):
                duration = 0
            if (
                not video_streams
                or 'mp4' not in container
                or duration <= 0
                or (require_audio and not audio_streams)
            ):
                raise RuntimeError("생성된 파일이 유효한 MP4/오디오 스트림을 포함하지 않습니다.")
            return

        capture = cv2.VideoCapture(video_path)
        try:
            if not capture.isOpened() or capture.get(cv2.CAP_PROP_FRAME_COUNT) <= 0:
                raise RuntimeError("생성된 파일에 읽을 수 있는 비디오 프레임이 없습니다.")
        finally:
            capture.release()
        if require_audio:
            ffmpeg = VideoEditor._find_ffmpeg()
            if not ffmpeg:
                raise RuntimeError("MP4 오디오 스트림 검증에 필요한 FFmpeg를 찾을 수 없습니다.")
            audio_check = subprocess.run(
                [ffmpeg, '-v', 'error', '-i', video_path, '-map', '0:a:0', '-t', '0.1', '-f', 'null', '-'],
                capture_output=True,
                text=True,
                check=False,
            )
            if audio_check.returncode != 0:
                raise RuntimeError("생성된 MP4의 오디오 스트림을 확인할 수 없습니다.")
    
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
        watermark_clip = None
        final_clip = None
        try:
            width, height = int(video_clip.w), int(video_clip.h)
            watermark_image = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(watermark_image)
            try:
                font = ImageFont.truetype('arial.ttf', 30)
            except OSError:
                font = ImageFont.load_default()
            bounds = draw.textbbox((0, 0), watermark_text, font=font)
            text_width = bounds[2] - bounds[0]
            text_height = bounds[3] - bounds[1]
            margin = max(8, width // 40)
            draw.text(
                (max(0, width - text_width - margin), max(0, height - text_height - margin)),
                watermark_text,
                font=font,
                fill=(255, 255, 255, 150),
                stroke_width=max(1, width // 540),
                stroke_fill=(0, 0, 0, 150),
            )
            watermark_clip = ImageClip(
                np.asarray(watermark_image),
                transparent=True,
                duration=video_clip.duration,
            )
            final_clip = CompositeVideoClip([video_clip, watermark_clip], size=video_clip.size)
            final_clip.write_videofile(output_path, fps=self.fps, codec='libx264')
            self._validate_video(output_path)
            return output_path
        finally:
            if final_clip is not None:
                final_clip.close()
            if watermark_clip is not None:
                watermark_clip.close()
            video_clip.close()
    
    def optimize_video_for_platform(self, video_path: str, platform: str = "youtube") -> str:
        """플랫폼별 비디오 최적화"""

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

        output_path = os.path.join(self.output_dir, f'optimized_{platform}.mp4')
        ffmpeg = self._find_ffmpeg()
        if ffmpeg:
            require_audio = self._has_audio_stream(video_path, ffmpeg)
            command = [
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                '-i', video_path,
                '-map', '0:v:0',
            ]
            if require_audio:
                command.extend(['-map', '0:a:0', '-c:a', 'aac', '-b:a', '192k'])
            else:
                command.append('-an')
            command.extend([
                '-vf',
                f'scale={target_width}:{target_height}:force_original_aspect_ratio=increase,'
                f'crop={target_width}:{target_height},setsar=1,fps={int(self.fps)}',
                '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
                '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
                output_path,
            ])
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            if result.returncode != 0:
                raise RuntimeError("FFmpeg가 플랫폼용 MP4 최적화를 완료하지 못했습니다.")
            self._validate_video(output_path, require_audio=require_audio)
            return output_path

        video_clip = VideoFileClip(video_path)
        resized_clip = video_clip
        try:
            if video_clip.w != target_width or video_clip.h != target_height:
                if hasattr(video_clip, 'resized'):
                    resized_clip = video_clip.resized((target_width, target_height))
                else:
                    resized_clip = video_clip.resize((target_width, target_height))
            has_audio = video_clip.audio is not None
            write_options = {'fps': self.fps, 'codec': 'libx264'}
            if has_audio:
                write_options['audio_codec'] = 'aac'
            resized_clip.write_videofile(output_path, **write_options)
            self._validate_video(output_path, require_audio=has_audio)
            return output_path
        finally:
            if resized_clip is not video_clip:
                resized_clip.close()
            video_clip.close()

    @staticmethod
    def _has_audio_stream(video_path: str, ffmpeg: str) -> bool:
        result = subprocess.run(
            [
                ffmpeg, '-hide_banner', '-loglevel', 'error', '-i', video_path,
                '-map', '0:a:0', '-t', '0.1', '-f', 'null', '-',
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0
