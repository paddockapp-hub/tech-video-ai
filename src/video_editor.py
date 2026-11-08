"""
Video Editor Module
고화질 1080x1920 9:16 공학 쇼츠 모션 그래픽 렌더러 및 바이럴 하이라이트 자막 합성 엔진
"""

import os
import re
import json
import math
import shutil
import subprocess
from typing import Dict, List, Any, Optional, Tuple
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np
import cv2

# MoviePy 호환성 import
try:
    from moviepy import (
        ImageClip, VideoFileClip, CompositeVideoClip,
        TextClip, concatenate_videoclips, AudioFileClip
    )
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False


class VideoEditor:
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.fps = int(self.config.get('fps', 24) or 24)
        self.width = int(self.config.get('image_width', 1080) or 1080)
        self.height = int(self.config.get('image_height', 1920) or 1920)
        self.output_dir = self.config.get('output_dir', 'output')
        self.temp_dir = self.config.get('temp_dir', 'temp')
        self.last_audio_source = 'none'
        self.last_subtitle_cues = []
        self.last_visual_source = 'motion-graphics'

        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(self.temp_dir, exist_ok=True)
        self._font_cache = {}

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

    def _get_korean_font(self, size: int) -> ImageFont.FreeTypeFont:
        if size in self._font_cache:
            return self._font_cache[size]
        candidates = [
            'C:/Windows/Fonts/malgunbd.ttf', # Malgun Gothic Bold
            'C:/Windows/Fonts/malgun.ttf',
            'C:/Windows/Fonts/gulim.ttc',
            'C:/Windows/Fonts/arialbd.ttf',
            'C:/Windows/Fonts/arial.ttf'
        ]
        for font_path in candidates:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, size)
                    self._font_cache[size] = font
                    return font
                except Exception:
                    pass
        default_font = ImageFont.load_default()
        self._font_cache[size] = default_font
        return default_font

    @staticmethod
    def _get_audio_duration(audio_path: str) -> float:
        if not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
            raise FileNotFoundError("오디오 음성 파일을 찾을 수 없거나 비어 있습니다.")
        ffmpeg = VideoEditor._find_ffmpeg()
        if ffmpeg:
            cmd = [ffmpeg, '-hide_banner', '-i', audio_path, '-map', '0:a:0', '-f', 'null', '-']
            try:
                res = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired):
                raise RuntimeError("오디오 길이를 측정할 수 없습니다.") from None
            match = re.search(r'Duration:\s*(\d+):(\d+):([\d.]+)', res.stderr or '')
            if res.returncode == 0 and match:
                duration = (
                    int(match.group(1)) * 3600
                    + int(match.group(2)) * 60
                    + float(match.group(3))
                )
                if duration > 0:
                    return duration
        if MOVIEPY_AVAILABLE:
            ac = None
            try:
                ac = AudioFileClip(audio_path)
                dur = float(ac.duration or 0)
                if dur > 0:
                    return dur
            except Exception:
                raise RuntimeError("오디오 길이를 측정할 수 없습니다.") from None
            finally:
                if ac is not None:
                    ac.close()
        raise RuntimeError("오디오 길이를 측정할 수 없습니다.")

    def _split_into_viral_chunks(self, text: str) -> List[Tuple[str, Tuple[int, int, int]]]:
        """바이럴 자막용 핵심 키워드 감지 및 색상 분기 (Electric Yellow / Neon Cyan / Pure White)"""
        keywords_yellow = [
            '원리', '핵심', '손실 0', '손실0', '손실 제로', '에너지', '양력', '속도',
            '비행기', '압력', '전기차', '모터', '배터리', '초전도체', '저항 0', '저항',
            '중력', '가속도', '효율', '100%', '법칙', '비밀', '이유', '차이', '증명'
        ]
        keywords_cyan = [
            '엔지니어링', '익스플레인', '공학', '과학', '기술', '시스템', '메커니즘',
            '발생', '변환', '작동', '이동', '상승', '해결'
        ]

        words = text.split()
        chunks = []
        for word in words:
            matched_color = (255, 255, 255) # Pure White 기본
            for kw in keywords_yellow:
                if kw in word:
                    matched_color = (255, 222, 0) # Electric Yellow 강조
                    break
            if matched_color == (255, 255, 255):
                for kw in keywords_cyan:
                    if kw in word:
                        matched_color = (0, 229, 255) # Neon Cyan 강조
                        break
            chunks.append((word + ' ', matched_color))
        return chunks

    @staticmethod
    def _subtitle_lines(text: str, font, max_width: int, draw) -> List[str]:
        lines = []
        current = ''
        tokens = re.findall(r'\S+\s*', text.strip())
        for token in tokens:
            candidate = current + token
            if current and draw.textbbox((0, 0), candidate, font=font)[2] <= max_width:
                current = candidate
                continue
            if current:
                lines.append(current.strip())
                current = ''

            if draw.textbbox((0, 0), token, font=font)[2] > max_width:
                for character in token:
                    candidate = current + character
                    if current and draw.textbbox((0, 0), candidate, font=font)[2] > max_width:
                        lines.append(current.strip())
                        current = character
                    else:
                        current = candidate
            else:
                current = token
        if current.strip():
            lines.append(current.strip())
        return lines or ['']

    def _build_subtitle_cues(
        self,
        text: str,
        duration: float,
        font,
        max_width: int,
        timed_sentences: List[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Create readable cues using provider timings or an explicitly marked estimate."""
        draw = ImageDraw.Draw(Image.new('RGB', (1, 1)))
        if timed_sentences:
            cues = []
            for sentence in timed_sentences:
                sentence_text = sentence.get('text', '').strip()
                start = max(0.0, float(sentence.get('start', 0)))
                end = max(start, float(sentence.get('end', start)))
                if not sentence_text or end <= start:
                    continue
                lines = self._subtitle_lines(sentence_text, font, max_width, draw)
                groups = [
                    '\n'.join(lines[index:index + 2])
                    for index in range(0, len(lines), 2)
                ]
                group_weights = [
                    max(1, len(re.sub(r'\s', '', group)))
                    for group in groups
                ]
                total_weight = sum(group_weights)
                elapsed = start
                for index, (group, weight) in enumerate(zip(groups, group_weights)):
                    group_end = end if index == len(groups) - 1 else (
                        elapsed + (end - start) * weight / total_weight
                    )
                    cues.append({
                        'text': group,
                        'start': round(elapsed, 3),
                        'end': round(group_end, 3),
                    })
                    elapsed = group_end
            return cues

        phrases = [
            phrase.strip()
            for phrase in re.split(r'(?<=[.!?。！？])\s*', text.strip())
            if phrase.strip()
        ]
        if not phrases and text.strip():
            phrases = [text.strip()]

        cue_texts = []
        for phrase in phrases:
            lines = self._subtitle_lines(phrase, font, max_width, draw)
            for index in range(0, len(lines), 2):
                cue_texts.append('\n'.join(lines[index:index + 2]))
        if not cue_texts:
            return []

        weights = [max(1, len(re.sub(r'\s', '', cue))) for cue in cue_texts]
        total_weight = sum(weights)
        elapsed = 0.0
        cues = []
        for index, (cue_text, weight) in enumerate(zip(cue_texts, weights)):
            end = duration if index == len(cue_texts) - 1 else (
                elapsed + duration * weight / total_weight
            )
            cues.append({'text': cue_text, 'start': elapsed, 'end': end})
            elapsed = end
        return cues

    @staticmethod
    def _prepare_scene_artwork(path: str, size: Tuple[int, int]):
        if not path or not os.path.isfile(path):
            return None
        try:
            with Image.open(path) as source:
                return np.asarray(
                    ImageOps.fit(source.convert('RGB'), size, method=Image.Resampling.LANCZOS)
                )
        except (OSError, ValueError):
            return None

    def create_viral_shorts_video(
        self,
        scenes: List[Dict],
        script_text: str,
        audio_path: str,
        output_path: str = None,
        sentences: List[Dict] = None,
        duration_seconds: float = None
    ) -> Dict:
        """
        Render a vertical engineering explainer with scene artwork, motion, and narration captions.
        Timings from speech providers are preferred; otherwise caption timing is estimated.
        """
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'final_video.mp4')
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        if not audio_path or not os.path.isfile(audio_path):
            try:
                from .tts_service import TTSService
            except ImportError:
                from tts_service import TTSService
            fallback_tts = TTSService({'output_dir': self.output_dir, 'temp_dir': self.temp_dir})
            audio_path = fallback_tts._generate_synthetic_tone_wav(
                os.path.join(self.temp_dir, 'pipeline_tone.wav'),
                duration_sec=max(3.0, len(script_text) * 0.15),
            )
            self.last_audio_source = fallback_tts.last_provider
        elif self.last_audio_source != 'synthetic-fallback':
            self.last_audio_source = 'provided'

        measured_audio_duration = self._get_audio_duration(audio_path)
        requested_duration = float(duration_seconds or 0)
        audio_dur = max(measured_audio_duration, requested_duration)

        ffmpeg = self._find_ffmpeg()
        if not ffmpeg:
            raise RuntimeError("FFmpeg 바이너리를 찾을 수 없습니다.")

        w, h = self.width, self.height
        fps = self.fps
        total_frames = int(audio_dur * fps) + 1

        # Fonts
        font_tag = self._get_korean_font(32)
        font_scene = self._get_korean_font(42)
        font_sub = self._get_korean_font(max(28, int(w * 0.048)))

        # Pre-render static blueprint background
        bg = Image.new('RGB', (w, h), (7, 11, 18))
        bg_draw = ImageDraw.Draw(bg)
        grid_color = (16, 28, 44)
        for x in range(0, w, 60):
            bg_draw.line([(x, 0), (x, h)], fill=grid_color, width=1)
        for y in range(0, h, 60):
            bg_draw.line([(0, y), (w, y)], fill=grid_color, width=1)

        # Left technical coordinate axis
        bg_draw.line([(70, 0), (70, h)], fill=(0, 180, 216), width=2)
        for mark_y in [400, 800, 1200, 1600]:
            bg_draw.line([(60, mark_y), (80, mark_y)], fill=(0, 229, 255), width=2)
            bg_draw.text((25, mark_y - 10), f"{mark_y//100:02d}", fill=(80, 120, 160), font=font_tag)

        # Top Header Tag (Matching reference video)
        bg_draw.text((w // 2, 140), 'TECH/VIDEO  /  ENGINEERING EXPLAINER', fill=(0, 229, 255), font=font_tag, anchor='mm')
        bg_draw.line([(w // 2 - 240, 175), (w // 2 + 240, 175)], fill=(0, 150, 180), width=1)

        # Prepare scene segments
        scene_count = max(len(scenes), 1)
        scene_interval = audio_dur / scene_count
        timed_scenes = []
        for idx, sc in enumerate(scenes):
            s_start = idx * scene_interval
            s_end = (idx + 1) * scene_interval if idx < scene_count - 1 else audio_dur
            timed_scenes.append({
                'number': sc.get('scene_number', idx + 1),
                'title': sc.get('title') or sc.get('description', f'{idx+1}단계'),
                'subtitle': sc.get('subtitle') or sc.get('description', ''),
                'base_image_path': sc.get('base_image_path'),
                'infographic_image_path': sc.get('infographic_image_path'),
                'start': s_start,
                'end': s_end
            })

        card_width = int(w * 0.78)
        card_height = int(h * 0.45)
        card_x = (w - card_width) // 2
        card_y = int(h * 0.22)
        card_mask = Image.new('L', (card_width, card_height), 0)
        ImageDraw.Draw(card_mask).rounded_rectangle(
            (0, 0, card_width - 1, card_height - 1),
            radius=max(12, int(w * 0.025)),
            fill=255,
        )
        scene_artwork = {}
        for scene in timed_scenes:
            scene_artwork[scene['number']] = (
                self._prepare_scene_artwork(
                    scene['base_image_path'],
                    (card_width, card_height),
                ),
                self._prepare_scene_artwork(
                    scene['infographic_image_path'],
                    (card_width, card_height),
                ),
            )
        has_scene_artwork = any(base is not None for base, _ in scene_artwork.values())
        self.last_visual_source = (
            'scene-artwork-with-parallax'
            if has_scene_artwork
            else 'motion-graphics'
        )
        subtitle_cues = self._build_subtitle_cues(
            script_text,
            audio_dur,
            font_sub,
            int(w * 0.78),
            timed_sentences=sentences,
        )
        self.last_subtitle_cues = subtitle_cues

        # Launch FFmpeg streaming process
        ffmpeg_cmd = [
            ffmpeg, '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{w}x{h}',
            '-pix_fmt', 'rgb24',
            '-r', str(fps),
            '-i', '-', # Stdin raw video
            '-i', audio_path,
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            output_path
        ]

        proc = subprocess.Popen(
            ffmpeg_cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE
        )

        cx, cy = w // 2, h // 2 - 40
        generated_images = []
        scene_saved = set()
        image_dir = os.path.join(os.path.dirname(output_path), 'images')
        os.makedirs(image_dir, exist_ok=True)

        for frame_idx in range(total_frames):
            t_sec = frame_idx / fps
            frame = bg.copy()
            draw = ImageDraw.Draw(frame)

            # Active scene
            current_scene = timed_scenes[0]
            for sc in timed_scenes:
                if sc['start'] <= t_sec <= sc['end']:
                    current_scene = sc
                    break

            # Scene counter & title
            scene_num = current_scene['number']
            scene_title = current_scene['title']
            if not scene_title.startswith(f"{scene_num:02d}"):
                scene_title = f"{scene_num:02d} / {scene_title}"

            draw.text((110, 260), scene_title[:38], fill=(0, 210, 240), font=font_scene)
            draw.rectangle([(520, 310), (720, 318)], fill=(0, 180, 216))

            base_art, infographic_art = scene_artwork.get(scene_num, (None, None))
            if base_art is not None:
                scene_progress = min(
                    1.0,
                    max(0.0, (t_sec - current_scene['start']) / max(
                        0.01,
                        current_scene['end'] - current_scene['start'],
                    )),
                )
                zoom = 1.0 + 0.045 * scene_progress
                drift = int(math.sin(scene_progress * math.pi) * card_width * 0.012)
                transform = np.float32([
                    [zoom, 0, (1 - zoom) * card_width / 2 + drift],
                    [0, zoom, (1 - zoom) * card_height / 2],
                ])
                moving_art = cv2.warpAffine(
                    base_art,
                    transform,
                    (card_width, card_height),
                    flags=cv2.INTER_LINEAR,
                    borderMode=cv2.BORDER_REFLECT,
                )
                if infographic_art is not None:
                    overlay_transform = transform.copy()
                    overlay_transform[0, 2] -= drift * 0.55
                    moving_overlay = cv2.warpAffine(
                        infographic_art,
                        overlay_transform,
                        (card_width, card_height),
                        flags=cv2.INTER_LINEAR,
                        borderMode=cv2.BORDER_REFLECT,
                    )
                    moving_art = cv2.addWeighted(moving_art, 0.78, moving_overlay, 0.22, 0)
                frame.paste(Image.fromarray(moving_art), (card_x, card_y), card_mask)
                draw = ImageDraw.Draw(frame)
                draw.rounded_rectangle(
                    (card_x, card_y, card_x + card_width - 1, card_y + card_height - 1),
                    radius=max(12, int(w * 0.025)),
                    outline=(0, 210, 235),
                    width=max(2, w // 360),
                )
                progress_x = card_x + int(card_width * scene_progress)
                draw.line(
                    (card_x, card_y + card_height + 12, progress_x, card_y + card_height + 12),
                    fill=(0, 229, 255),
                    width=max(3, w // 240),
                )
                draw.text(
                    (card_x, card_y + card_height + 32),
                    f'SCENE {scene_num:02d} / {scene_count:02d}',
                    fill=(115, 165, 190),
                    font=font_tag,
                )
            else:
                angle = (frame_idx * 3) % 360
                draw.ellipse(
                    [(cx - 170, cy - 170), (cx + 170, cy + 170)],
                    outline=(0, 180, 216),
                    width=3,
                )
                for angle_offset in (0, 90, 180, 270):
                    radians = math.radians(angle + angle_offset)
                    start = (
                        cx + int(170 * math.cos(radians)),
                        cy + int(170 * math.sin(radians)),
                    )
                    end = (
                        cx + int(225 * math.cos(radians)),
                        cy + int(225 * math.sin(radians)),
                    )
                    draw.line((start, end), fill=(0, 229, 255), width=3)

            # Use explicit timings when supplied; otherwise estimate from script length.
            sub_text = ''
            for cue in subtitle_cues:
                if cue['start'] <= t_sec < cue['end']:
                    sub_text = cue['text']
                    break
            if not sub_text:
                sub_text = current_scene['subtitle']

            # Render Viral Subtitle
            if sub_text:
                subtitle_lines = sub_text.splitlines()[:2]
                line_chunks = [self._split_into_viral_chunks(line) for line in subtitle_lines]
                line_widths = [
                    sum(draw.textbbox((0, 0), part, font=font_sub)[2] for part, _ in chunks)
                    for chunks in line_chunks
                ]
                box_width = min(w - 40, max(line_widths, default=0) + 56)
                line_height = max(48, int(w * 0.065))
                box_height = line_height * max(1, len(line_chunks)) + 36
                box_left = (w - box_width) // 2
                box_top = int(h * 0.80)
                draw.rounded_rectangle(
                    (
                        box_left,
                        box_top,
                        box_left + box_width,
                        box_top + box_height,
                    ),
                    radius=max(10, w // 60),
                    fill=(10, 16, 28),
                    outline=(0, 180, 216),
                    width=max(2, w // 540),
                )
                for line_index, chunks in enumerate(line_chunks):
                    line_x = (w - line_widths[line_index]) // 2
                    line_y = box_top + 12 + line_index * line_height
                    for part, color in chunks:
                        draw.text(
                            (line_x, line_y),
                            part,
                            fill=color,
                            font=font_sub,
                            stroke_width=max(2, w // 216),
                            stroke_fill=(0, 0, 0),
                        )
                        line_x += draw.textbbox((0, 0), part, font=font_sub)[2]

            # Save preview thumbnail for each scene
            if scene_num not in scene_saved:
                scene_img_path = os.path.join(image_dir, f"scene_{scene_num:02d}_base.png")
                frame.save(scene_img_path)
                generated_images.append({
                    'scene_number': scene_num,
                    'description': current_scene['subtitle'],
                    'base_image': scene_img_path
                })
                scene_saved.add(scene_num)

            proc.stdin.write(frame.tobytes())

        proc.stdin.close()
        stderr = proc.stderr.read().decode('utf-8', errors='ignore')
        proc.stderr.close()
        proc.wait()

        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg 비디오 인코딩 실패: {stderr}")

        # Validate video integrity and audio stream
        self._validate_video(output_path, require_audio=True)
        print(f"[VideoEditor] 고화질 모션 그래픽 비디오 생성 완료: {output_path} ({audio_dur:.2f}s)")

        return {
            'video_path': output_path,
            'duration_seconds': audio_dur,
            'generated_images': generated_images,
            'subtitles': subtitle_cues,
            'visual_source': self.last_visual_source,
        }

    def create_motion_graphics_video(
        self,
        keyframes: List[Dict],
        audio_path: str = None,
        sentences: List[Dict] = None,
    ) -> str:
        """기존 파이프라인 호환용 모션 그래픽 렌더러"""
        self.last_audio_source = 'provided' if audio_path and os.path.isfile(audio_path) else 'none'
        scenes = []
        for kf in keyframes:
            scenes.append({
                'scene_number': kf.get('id', len(scenes) + 1),
                'title': (
                    kf.get('title')
                    or kf.get('segment_text')
                    or kf.get('script_segment')
                    or f"Scene {kf.get('id', len(scenes) + 1)}"
                ),
                'subtitle': (
                    kf.get('segment_text')
                    or kf.get('script_segment')
                    or kf.get('description', '')
                ),
                'base_image_path': kf.get('base_image_path'),
                'infographic_image_path': kf.get('infographic_image_path'),
            })

        output_path = os.path.join(self.output_dir, 'final_video.mp4')
        if not audio_path or not os.path.isfile(audio_path):
            # Create synthetic audio if missing so audio is NEVER dropped
            try:
                from .tts_service import TTSService
            except ImportError:
                from tts_service import TTSService

            try:
                tts = TTSService({'output_dir': self.output_dir})
                audio_path = tts._generate_synthetic_tone_wav(
                    os.path.join(self.output_dir, 'pipeline_tone.wav'),
                    duration_sec=sum(kf.get('duration', 3) for kf in keyframes)
                )
                self.last_audio_source = tts.last_provider
            except Exception:
                raise RuntimeError("The pipeline could not create fallback audio.") from None

        res = self.create_viral_shorts_video(
            scenes=scenes,
            script_text=" ".join(s['subtitle'] for s in scenes),
            audio_path=audio_path,
            output_path=output_path,
            sentences=sentences,
        )
        self.last_subtitle_cues = res['subtitles']
        self.last_visual_source = res['visual_source']
        return res['video_path']

    def create_video_from_images(
        self,
        image_paths: List[str],
        durations: List[float],
        output_path: str = None,
        audio_path: str = None
    ) -> str:
        """이미지 목록으로부터 비디오 생성 (오디오 포함 보장)"""
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'from_images.mp4')
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)

        ffmpeg = self._find_ffmpeg()
        if not image_paths or len(image_paths) != len(durations):
            raise ValueError("Image paths and durations must contain the same nonzero number of items.")
        if any(not os.path.isfile(image_path) for image_path in image_paths):
            raise FileNotFoundError("A video scene image is missing.")
        if any(float(duration) <= 0 for duration in durations):
            raise ValueError("Scene durations must be positive.")
        scene_durations = [float(duration) for duration in durations]
        if audio_path:
            if not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                raise FileNotFoundError("The narration audio file is missing or empty.")
            audio_duration = self._get_audio_duration(audio_path)
            scene_duration = sum(scene_durations)
            if audio_duration > scene_duration:
                scene_durations[-1] += audio_duration - scene_duration
        total_dur = sum(scene_durations)

        if ffmpeg:
            cmd = [ffmpeg, '-y']
            filters = []
            for idx, img in enumerate(image_paths):
                cmd.extend(['-loop', '1', '-t', str(scene_durations[idx]), '-i', img])
                filters.append(f'[{idx}:v]scale={self.width}:{self.height}:force_original_aspect_ratio=increase,crop={self.width}:{self.height},setsar=1,fps={self.fps},format=yuv420p[v{idx}]')

            v_inputs = ''.join(f'[v{i}]' for i in range(len(image_paths)))
            filters.append(f'{v_inputs}concat=n={len(image_paths)}:v=1:a=0[outv]')

            cmd.extend(['-filter_complex', ';'.join(filters), '-map', '[outv]'])

            if audio_path and os.path.isfile(audio_path):
                cmd.extend(['-i', audio_path, '-map', f'{len(image_paths)}:a:0', '-c:a', 'aac', '-b:a', '192k'])
            else:
                # 무음 오디오 트랙 생성 삽입 (비디오 플레이어/터널링 호환성 유지)
                cmd.extend(['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-c:a', 'aac', '-b:a', '128k', '-shortest'])

            cmd.extend([
                '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '22',
                '-pix_fmt', 'yuv420p', '-t', str(total_dur), '-movflags', '+faststart',
                output_path
            ])
            subprocess.run(cmd, capture_output=True, check=True)
            self._validate_video(output_path, require_audio=True)
            return output_path

        if MOVIEPY_AVAILABLE:
            clips = [ImageClip(img, duration=dur) for img, dur in zip(image_paths, scene_durations)]
            final_video = None
            ac = None
            try:
                final_video = concatenate_videoclips(clips, method="compose")
                if audio_path:
                    ac = AudioFileClip(audio_path)
                    if hasattr(final_video, 'with_audio'):
                        final_video = final_video.with_audio(ac)
                    else:
                        final_video = final_video.set_audio(ac)
                write_options = {'fps': self.fps, 'codec': 'libx264'}
                if ac:
                    write_options['audio_codec'] = 'aac'
                final_video.write_videofile(output_path, **write_options)
                self._validate_video(output_path, require_audio=bool(audio_path))
            finally:
                if final_video is not None:
                    final_video.close()
                if ac is not None:
                    ac.close()
                for clip in clips:
                    clip.close()
            return output_path

        raise RuntimeError("비디오 인코더(FFmpeg/MoviePy)를 찾을 수 없습니다.")

    def _create_with_ffmpeg(
        self,
        scenes,
        audio_path: str,
        output_path: str,
        ffmpeg: str,
    ) -> None:
        if not scenes:
            raise ValueError("At least one scene is required.")
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        scene_data = list(scenes)
        if audio_path:
            audio_duration = self._get_audio_duration(audio_path)
            scene_duration = sum(scene[2] for scene in scene_data)
            if audio_duration > scene_duration:
                base_image, infographic_image, duration = scene_data[-1]
                scene_data[-1] = (
                    base_image,
                    infographic_image,
                    duration + audio_duration - scene_duration,
                )

        width, height, fps = int(self.width), int(self.height), int(self.fps)
        total_duration = sum(scene[2] for scene in scene_data)
        command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y']
        filters = []
        for index, (base_image, infographic_image, duration) in enumerate(scene_data):
            input_duration = duration + (1 / fps)
            command.extend([
                '-loop', '1', '-framerate', str(fps), '-t', str(input_duration),
                '-i', base_image,
                '-loop', '1', '-framerate', str(fps), '-t', str(input_duration),
                '-i', infographic_image,
            ])
            base_index, overlay_index = index * 2, index * 2 + 1
            filters.extend([
                f'[{base_index}:v]scale={width}:{height}:force_original_aspect_ratio=increase,'
                f'crop={width}:{height},setsar=1,fps={fps},format=yuv420p[base{index}]',
                f'[{overlay_index}:v]scale={width}:{height}:force_original_aspect_ratio=increase,'
                f'crop={width}:{height},setsar=1,fps={fps},format=rgba,'
                f'colorchannelmixer=aa=0.45[overlay{index}]',
                f'[base{index}][overlay{index}]overlay=0:0:shortest=1,'
                f'trim=duration={duration},setpts=PTS-STARTPTS,format=yuv420p[scene{index}]',
            ])

        if audio_path:
            if not os.path.isfile(audio_path) or os.path.getsize(audio_path) == 0:
                raise FileNotFoundError("생성된 음성 파일을 찾을 수 없거나 비어 있습니다.")
            audio_index = len(scene_data) * 2
            command.extend(['-i', audio_path])
        labels = ''.join(f'[scene{index}]' for index in range(len(scene_data)))
        filters.append(f'{labels}concat=n={len(scene_data)}:v=1:a=0[video]')
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
            raise RuntimeError("FFmpeg could not complete video encoding.")
        self._validate_video(output_path, require_audio=bool(audio_path))

    def _create_with_moviepy(self, scenes, audio_path: str, output_path: str) -> str:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        if not scenes:
            raise ValueError("At least one scene is required.")
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        scene_data = list(scenes)
        if audio_path:
            audio_duration = self._get_audio_duration(audio_path)
            scene_duration = sum(scene[2] for scene in scene_data)
            if audio_duration > scene_duration:
                base_image, infographic_image, duration = scene_data[-1]
                scene_data[-1] = (
                    base_image,
                    infographic_image,
                    duration + audio_duration - scene_duration,
                )

        clips = []
        audio_clip = None
        final_video = None
        try:
            for base_image, infographic_image, duration in scene_data:
                clips.append(self._create_scene_clip(base_image, infographic_image, duration))
            final_video = concatenate_videoclips(clips, method='compose')
            if audio_path:
                audio_clip = AudioFileClip(audio_path)
                if not audio_clip.duration or audio_clip.duration <= 0:
                    raise ValueError("The audio duration is invalid.")
                if hasattr(final_video, 'with_audio'):
                    final_video = final_video.with_audio(audio_clip)
                else:
                    final_video = final_video.set_audio(audio_clip)
            options = {'fps': self.fps, 'codec': 'libx264', 'threads': 4}
            if audio_clip:
                options['audio_codec'] = 'aac'
            final_video.write_videofile(output_path, **options)
            self._validate_video(output_path, require_audio=bool(audio_path))
            return output_path
        finally:
            if final_video is not None:
                final_video.close()
            if audio_clip is not None:
                audio_clip.close()
            for clip in clips:
                clip.close()

    def _create_scene_clip(
        self,
        base_image: str,
        infographic_image: str,
        duration: float,
    ) -> CompositeVideoClip:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        base_clip = ImageClip(base_image, duration=duration)
        infographic_clip = ImageClip(infographic_image, duration=duration)
        if hasattr(infographic_clip, 'with_opacity'):
            infographic_clip = infographic_clip.with_opacity(0.45)
        else:
            infographic_clip = infographic_clip.set_opacity(0.45)
        return CompositeVideoClip([base_clip, infographic_clip], size=base_clip.size)

    def create_transition_video(
        self,
        clips: List[ImageClip],
        transition_type: str = 'fade',
    ) -> VideoFileClip:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        return concatenate_videoclips(clips, method='compose')

    def add_text_overlay(
        self,
        video_clip: VideoFileClip,
        text: str,
        position: str = 'bottom',
        fontsize: int = 50,
    ) -> VideoFileClip:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        width, height = map(int, video_clip.size)
        overlay = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        font = self._get_korean_font(fontsize)
        bounds = draw.textbbox((0, 0), text, font=font, stroke_width=2)
        text_width, text_height = bounds[2] - bounds[0], bounds[3] - bounds[1]
        x = max(0, (width - text_width) // 2)
        y = max(0, height - text_height - height // 10) if position == 'bottom' else (
            height // 10 if position == 'top' else max(0, (height - text_height) // 2)
        )
        draw.text((x, y), text, font=font, fill='white', stroke_width=2, stroke_fill='black')
        text_clip = ImageClip(np.asarray(overlay), transparent=True, duration=video_clip.duration)
        return CompositeVideoClip([video_clip, text_clip], size=video_clip.size)

    def organize_clips_with_gpt(self, clips_info: List[Dict], gpt_service) -> List[Dict]:
        organized = gpt_service.organize_clip_sequence(clips_info)
        if not isinstance(organized, list) or len(organized) != len(clips_info):
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
        if (
            len(positions) != len(clips_info)
            or len(set(positions.values())) != len(clips_info)
        ):
            gpt_service.last_generation_source = 'fallback'
            return clips_info
        return [clips_info[index] for index in sorted(positions, key=positions.get)]

    def add_subtitle_track(
        self,
        video_path: str,
        subtitles: List[Dict],
        output_path: str = None,
    ) -> str:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'with_subtitles.mp4')
        source = VideoFileClip(video_path)
        subtitle_clips = []
        final_clip = None
        try:
            for subtitle in subtitles:
                text = subtitle.get('text', '')
                start = max(0, float(subtitle.get('start', 0)))
                end = float(subtitle.get('end', start + 2))
                if not text or end <= start:
                    continue
                overlay = Image.new('RGBA', tuple(map(int, source.size)), (0, 0, 0, 0))
                draw = ImageDraw.Draw(overlay)
                font = self._get_korean_font(40)
                bounds = draw.textbbox((0, 0), text, font=font, stroke_width=2)
                x = max(0, (overlay.width - (bounds[2] - bounds[0])) // 2)
                y = max(0, int(overlay.height * 0.85))
                draw.text((x, y), text, font=font, fill='white', stroke_width=2, stroke_fill='black')
                clip = ImageClip(np.asarray(overlay), transparent=True, duration=end - start)
                clip = clip.with_start(start) if hasattr(clip, 'with_start') else clip.set_start(start)
                subtitle_clips.append(clip)
            final_clip = CompositeVideoClip([source] + subtitle_clips, size=source.size)
            write_options = {'fps': self.fps, 'codec': 'libx264'}
            if source.audio:
                write_options['audio_codec'] = 'aac'
            final_clip.write_videofile(output_path, **write_options)
            self._validate_video(output_path, require_audio=bool(source.audio))
            return output_path
        finally:
            if final_clip is not None:
                final_clip.close()
            for clip in subtitle_clips:
                clip.close()
            source.close()

    def create_preview_video(self, keyframes: List[Dict], preview_duration: int = 10) -> str:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        preview_clips = []
        preview_video = None
        elapsed = 0.0
        try:
            for keyframe in keyframes:
                if elapsed >= preview_duration:
                    break
                image_path = keyframe.get('base_image_path')
                if not image_path or not os.path.isfile(image_path):
                    continue
                duration = min(float(keyframe.get('duration', 2)), preview_duration - elapsed)
                if duration <= 0:
                    continue
                preview_clips.append(ImageClip(image_path, duration=duration))
                elapsed += duration
            if not preview_clips:
                raise ValueError("No valid keyframe images are available for the preview.")
            preview_video = concatenate_videoclips(preview_clips, method='compose')
            output_path = os.path.join(self.output_dir, 'preview_video.mp4')
            preview_video.write_videofile(output_path, fps=self.fps, codec='libx264')
            self._validate_video(output_path)
            return output_path
        finally:
            if preview_video is not None:
                preview_video.close()
            for clip in preview_clips:
                clip.close()

    def add_watermark(
        self,
        video_path: str,
        watermark_text: str,
        output_path: str = None,
    ) -> str:
        if not MOVIEPY_AVAILABLE:
            raise RuntimeError("MoviePy is not available.")
        if output_path is None:
            output_path = os.path.join(self.output_dir, 'watermarked_video.mp4')
        source = VideoFileClip(video_path)
        watermark_clip = None
        final_clip = None
        try:
            width, height = map(int, source.size)
            watermark = Image.new('RGBA', (width, height), (0, 0, 0, 0))
            draw = ImageDraw.Draw(watermark)
            font = self._get_korean_font(max(16, width // 36))
            bounds = draw.textbbox((0, 0), watermark_text, font=font)
            text_width, text_height = bounds[2] - bounds[0], bounds[3] - bounds[1]
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
                np.asarray(watermark),
                transparent=True,
                duration=source.duration,
            )
            final_clip = CompositeVideoClip([source, watermark_clip], size=source.size)
            write_options = {'fps': self.fps, 'codec': 'libx264'}
            if source.audio:
                write_options['audio_codec'] = 'aac'
            final_clip.write_videofile(output_path, **write_options)
            self._validate_video(output_path, require_audio=bool(source.audio))
            return output_path
        finally:
            if final_clip is not None:
                final_clip.close()
            if watermark_clip is not None:
                watermark_clip.close()
            source.close()

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

    def optimize_video_for_platform(self, video_path: str, platform: str = "youtube") -> str:
        """플랫폼별 비디오 최적화"""
        output_path = os.path.join(self.output_dir, f'optimized_{platform}.mp4')
        ffmpeg = self._find_ffmpeg()
        if ffmpeg:
            cmd = [
                ffmpeg, '-y', '-i', video_path,
                '-vf', f'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
                '-c:v', 'libx264', '-preset', 'fast', '-crf', '20',
                '-c:a', 'copy', '-movflags', '+faststart',
                output_path
            ]
            subprocess.run(cmd, capture_output=True, check=False)
            if os.path.isfile(output_path) and os.path.getsize(output_path) > 0:
                return output_path
        shutil.copy2(video_path, output_path)
        return output_path

    @staticmethod
    def _validate_video(video_path: str, require_audio: bool = False) -> None:
        if not os.path.isfile(video_path) or os.path.getsize(video_path) == 0:
            raise RuntimeError("비디오 파일이 생성되지 않았거나 크기가 0입니다.")
        with open(video_path, 'rb') as f:
            header = f.read(12)
        if len(header) < 8 or header[4:8] != b'ftyp':
            raise RuntimeError("MP4 container signature가 올바르지 않습니다.")

        cap = cv2.VideoCapture(video_path)
        try:
            if not cap.isOpened() or cap.get(cv2.CAP_PROP_FRAME_COUNT) <= 0:
                raise RuntimeError("비디오 프레임을 읽을 수 없습니다.")
        finally:
            cap.release()

        if require_audio:
            ffmpeg = VideoEditor._find_ffmpeg()
            if ffmpeg:
                probe = subprocess.run(
                    [ffmpeg, '-v', 'error', '-i', video_path, '-map', '0:a:0', '-t', '0.1', '-f', 'null', '-'],
                    capture_output=True, text=True, check=False
                )
                if probe.returncode != 0:
                    raise RuntimeError("생성된 MP4에 유효한 오디오 스트림이 없습니다.")
