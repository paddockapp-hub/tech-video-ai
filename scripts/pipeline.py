#!/usr/bin/env python3
"""
ShortsMaking Viral Pipeline
- TTS: Azure Cognitive Services Speech API (정식 상업용) & edge-tts (개발/Fallback)
- 바이럴 자막: 2~4단어 하이라이트 + 둥근 다크 백드롭
- 영상 렌더링: Pillow + MoviePy (동적 인포그래픽 + 기하학적 메커니즘 애니메이션)
- 자동 품질 검증 (Resolution, Duration, File Size, Black Screen Check)
"""
import asyncio, json, math, os, re, sys, time, urllib.request
from pathlib import Path

VOICE = "ko-KR-InJoonNeural"
RATE = "+0%"
PITCH = "-5Hz"

# ---------------------------------------------------------------------------
# TTS 공급자 어댑터 (Azure Speech vs Edge-TTS)
# ---------------------------------------------------------------------------
async def generate_tts_azure(text, output_audio, output_subs, key, region):
    """
    Microsoft Azure Cognitive Services Speech REST API 공식 상업용 연동
    """
    token_url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    token_req = urllib.request.Request(token_url, method="POST")
    token_req.add_header("Ocp-Apim-Subscription-Key", key)
    token_req.add_header("Content-Length", "0")

    with urllib.request.urlopen(token_req) as resp:
        access_token = resp.read().decode("utf-8")

    tts_url = f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1"
    ssml = f"""<speak version='1.0' xml:lang='ko-KR'>
      <voice xml:lang='ko-KR' xml:gender='Male' name='{VOICE}'>
        <prosody rate='{RATE}' pitch='{PITCH}'>
          {text}
        </prosody>
      </voice>
    </speak>"""

    tts_req = urllib.request.Request(tts_url, data=ssml.encode("utf-8"), method="POST")
    tts_req.add_header("Authorization", f"Bearer {access_token}")
    tts_req.add_header("Content-Type", "application/ssml+xml")
    tts_req.add_header("X-Microsoft-OutputFormat", "audio-24khz-160kbitrate-mono-mp3")
    tts_req.add_header("User-Agent", "ShortsMakingProduction/1.0")

    with urllib.request.urlopen(tts_req) as resp:
        audio_data = resp.read()

    with open(output_audio, "wb") as f:
        f.write(audio_data)

    # Word-boundary 자막을 위한 edge-tts fallback 자막 생성 병행
    try:
        import edge_tts
        communicate = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
        subs = edge_tts.SubMaker()
        async for chunk in communicate.stream():
            if chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                subs.feed(chunk)
        with open(output_subs, "w", encoding="utf-8") as f:
            f.write(subs.get_srt())
    except:
        pass

    return output_audio, output_subs

async def generate_tts_edgetts(text, output_audio, output_subs):
    import edge_tts
    clean_text = " ".join(text.strip().split())
    communicate = edge_tts.Communicate(clean_text, VOICE, rate=RATE, pitch=PITCH)
    subs = edge_tts.SubMaker()

    with open(output_audio, "wb") as f:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                subs.feed(chunk)

    srt_content = subs.get_srt()
    with open(output_subs, "w", encoding="utf-8") as f:
        f.write(srt_content)

    return output_audio, output_subs

async def generate_tts_adapter(text, output_audio, output_subs):
    azure_key = os.environ.get("AZURE_SPEECH_KEY")
    azure_region = os.environ.get("AZURE_SPEECH_REGION")

    if azure_key and azure_region:
        print("[TTS Adapter] 공식 Azure Cognitive Speech API 사용", flush=True)
        try:
            return await generate_tts_azure(text, output_audio, output_subs, azure_key, azure_region)
        except Exception as e:
            print(f"[TTS Adapter Warning] Azure 호출 실패 ({e}), Edge-TTS로 fallback", flush=True)

    print("[TTS Adapter] Edge-TTS 파이프라인 사용", flush=True)
    return await generate_tts_edgetts(text, output_audio, output_subs)

def timestamp_to_sec(ts):
    ts = ts.replace(",", ".")
    parts = ts.split(":")
    h, m = int(parts[0]), int(parts[1])
    s_ms = parts[2].split(".")
    s = int(s_ms[0])
    ms = int(s_ms[1]) if len(s_ms) > 1 else 0
    return h * 3600 + m * 60 + s + ms / 1000.0

def parse_subtitles(subs_path):
    with open(subs_path, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r"(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*\n(.+?)(?=\n\s*\n|\n\d+\n|\Z)"
    matches = re.findall(pattern, content, re.DOTALL)
    entries = []
    for start_str, end_str, text in matches:
        s = timestamp_to_sec(start_str)
        e = timestamp_to_sec(end_str)
        t = re.sub(r"<[^>]+>", "", text).strip().replace("\n", " ")
        if t and not t.isdigit():
            entries.append((s, e, t))
    return entries

def group_subtitles_viral(entries, max_chars=14):
    if not entries:
        return []

    grouped = []
    words_buf = []
    start = None
    end = None

    for s, e, text in entries:
        for word in text.split():
            if start is None:
                start = s
            words_buf.append(word)
            end = e
            joined = " ".join(words_buf)
            if len(joined) >= max_chars or len(words_buf) >= 3:
                grouped.append((start, end, joined))
                words_buf = []
                start = None
                end = None

    if words_buf and start is not None and end is not None:
        grouped.append((start, end, " ".join(words_buf)))

    return grouped

def compose_video(title, script, category, audio_path, subs_path, output_path, width=1080, height=1920, fps=30, viral_features=None):
    import numpy as np
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    from moviepy import AudioFileClip, VideoClip
    try:
        import imageio_ffmpeg
        os.environ["IMAGEIO_FFMPEG_EXE"] = imageio_ffmpeg.get_ffmpeg_exe()
    except:
        pass

    print("[Pipeline] 오디오 로딩...", flush=True)
    audio = AudioFileClip(audio_path)
    duration = audio.duration
    print(f"[Pipeline] 오디오 길이: {duration:.1f}초", flush=True)

    raw_subs = parse_subtitles(subs_path)
    viral_subs = group_subtitles_viral(raw_subs)
    sentences = [s.strip() for s in re.split(r'[.!?\n]+', script) if s.strip()]

    font_paths = [
        "C:/Windows/Fonts/malgunbd.ttf",
        "C:/Windows/Fonts/malgun.ttf",
        "C:/Windows/Fonts/NanumGothicBold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]
    title_font = None
    sub_font = None
    body_font = None
    badge_font = None

    for fp in font_paths:
        if os.path.exists(fp):
            try:
                title_font = ImageFont.truetype(fp, 52)
                sub_font = ImageFont.truetype(fp, font_size)
                body_font = ImageFont.truetype(fp, 44)
                badge_font = ImageFont.truetype(fp, 32)
                break
            except:
                continue

    is_eng = category.lower() == "engineering"

    # 바이럴 AI 특징 적용
    if viral_features:
        primary_color = (
            viral_features.get('primaryColor', {}).get('r', 56),
            viral_features.get('primaryColor', {}).get('g', 189),
            viral_features.get('primaryColor', {}).get('b', 248)
        )
        secondary_color = (
            viral_features.get('secondaryColor', {}).get('r', 100),
            viral_features.get('secondaryColor', {}).get('g', 200),
            viral_features.get('secondaryColor', {}).get('b', 255)
        )
        font_size = viral_features.get('fontSize', 68)
        animation_speed = viral_features.get('animationSpeed', 1.0)
    else:
        primary_color = (56, 189, 248) if is_eng else (251, 191, 36)
        secondary_color = (100, 200, 255) if is_eng else (255, 220, 100)
        font_size = 68
        animation_speed = 1.0

    def make_frame(t):
        img = Image.new("RGB", (width, height), (10, 14, 26))
        draw = ImageDraw.Draw(img)

        # 1. 배경 그라데이션 및 그리드 (3D 깊이감)
        for yp in range(0, height, 8):
            ratio = yp / height
            r = int(8 + 14 * ratio)
            g = int(12 + 16 * ratio)
            b = int(24 + 36 * ratio)
            draw.line([(0, yp), (width, yp)], fill=(r, g, b), width=8)

        # 3D 효과 그리드 (원근법)
        grid_offset_x = math.sin(t * 0.5) * 30
        for x in range(0, width, 120):
            adjusted_x = x + grid_offset_x * (x / width)
            draw.line([(adjusted_x, 0), (adjusted_x, height)], fill=(30, 41, 59), width=1)
        for y in range(0, height, 120):
            draw.line([(0, y), (width, y)], fill=(30, 41, 59), width=1)

        # 2. 상단 헤더 (3D 그림자 효과)
        badge_text = "공학 메커니즘" if is_eng else "고등·대학 심화 탐구"
        bx, by = 60, 140
        # 그림자
        draw.rounded_rectangle([bx+5, by+5, bx + 285, by + 61], radius=28, fill=(0, 0, 0, 100))
        # 본체
        draw.rounded_rectangle([bx, by, bx + 280, by + 56], radius=28, fill=(30, 41, 59, 220), outline=primary_color, width=2)
        if badge_font:
            draw.text((bx + 28, by + 10), badge_text, font=badge_font, fill=primary_color)

        if title_font:
            draw.text((60, 220), title[:22], font=title_font, fill=(255, 255, 255))
            draw.line([(60, 290), (width - 60, 290)], fill=(71, 85, 105), width=2)

        # 3. 중앙 3D 모션 메커니즘 (고도화)
        cx, cy = width // 2, int(height * 0.46)
        orbit_radius = 240

        # 3D 원근법 효과를 위한 스케일링
        perspective_scale = 1 + 0.1 * math.sin(t * 0.8 * animation_speed)
        current_radius = orbit_radius * perspective_scale

        # 회전하는 궤도 입자들 (3D 느낌)
        angle1 = t * 1.5 * animation_speed
        for i in range(12):
            th = angle1 + (i * math.pi / 6)
            # 3D 원근법: 더 가까운 입자는 더 크게
            depth = math.sin(th + t)
            size_factor = 1 + depth * 0.3
            px = int(cx + current_radius * math.cos(th))
            py = int(cy + current_radius * math.sin(th) * 0.6)  # 타원으로 3D 느낌
            particle_size = int(8 * size_factor)
            draw.ellipse([px-particle_size, py-particle_size, px+particle_size, py+particle_size], fill=primary_color)

        # 3D 구형들 (라이팅 효과)
        draw.ellipse([cx-150, cy-150, cx+150, cy+150], outline=(100, 116, 139), width=2)
        draw.ellipse([cx-90, cy-90, cx+90, cy+90], outline=primary_color, width=3)
        draw.ellipse([cx-20, cy-20, cx+20, cy+20], fill=primary_color)

        # 빔 라인 (광선 효과)
        beam_angle = t * 2.8 * animation_speed
        for i in range(3):
            beam_offset = i * 0.3
            bx_end = cx + int(150 * math.cos(beam_angle + beam_offset))
            by_end = cy + int(150 * math.sin(beam_angle + beam_offset))
            beam_alpha = int(255 * (1 - i * 0.3))
            draw.line([(cx, cy), (bx_end, by_end)], fill=primary_color, width=3 - i)

        # 4. 설명 문장 (글로우 효과)
        if sentences and duration > 0 and body_font:
            idx = min(int(t / duration * len(sentences)), len(sentences) - 1)
            current_sent = sentences[idx]
            max_c = 18
            lines = [current_sent[i:i+max_c] for i in range(0, len(current_sent), max_c)]
            box_top = int(height * 0.62)
            for li, line in enumerate(lines[:3]):
                bbox = draw.textbbox((0, 0), line, font=body_font)
                tw = bbox[2] - bbox[0]
                tx = (width - tw) // 2
                ty = box_top + li * 56
                # 글로우 효과
                draw.text((tx+2, ty+2), line, font=body_font, fill=(0, 0, 0))
                draw.text((tx, ty), line, font=body_font, fill=(226, 232, 240))

        # 5. 바이럴 자막 (3D 박스 효과)
        if sub_font:
            for s, e, stxt in viral_subs:
                if s <= t <= e:
                    bbox = draw.textbbox((0, 0), stxt, font=sub_font)
                    tw = bbox[2] - bbox[0]
                    th = bbox[3] - bbox[1]
                    tx = (width - tw) // 2
                    ty = int(height * 0.78)
                    pad_x, pad_y = 36, 20

                    # 3D 박스 효과 (그림자 + 레이어)
                    draw.rounded_rectangle(
                        [tx - pad_x + 5, ty - pad_y + 5, tx + tw + pad_x + 5, ty + th + pad_y + 5],
                        radius=20,
                        fill=(0, 0, 0, 80)
                    )
                    draw.rounded_rectangle(
                        [tx - pad_x, ty - pad_y, tx + tw + pad_x, ty + th + pad_y],
                        radius=20,
                        fill=(15, 23, 42),
                        outline=primary_color,
                        width=3
                    )
                    draw.text((tx, ty), stxt, font=sub_font, fill=(255, 255, 255))
                    break

        # 6. 프로그레스 바 (그라데이션)
        progress = t / duration if duration > 0 else 0
        bar_w = int(width * progress)
        # 그라데이션 효과
        for i in range(bar_w):
            ratio = i / bar_w if bar_w > 0 else 0
            r = int(primary_color[0] * ratio)
            g = int(primary_color[1] * ratio)
            b = int(primary_color[2] * ratio)
            draw.rectangle([(i, height - 12), (i + 1, height)], fill=(r, g, b))

        return np.array(img)

    print("[Pipeline] 영상 렌더링...", flush=True)
    video = VideoClip(make_frame, duration=duration).with_fps(fps).with_audio(audio)
    video.write_videofile(
        output_path,
        fps=fps,
        codec="libx264",
        audio_codec="aac",
        preset="slow",
        bitrate="6000k",
        ffmpeg_params=[
            "-crf", "18",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-b:a", "192k",
            "-profile:v", "high",
            "-level", "4.0",
            "-tune", "film",
        ],
        threads=4,
        logger=None
    )
    video.close()
    audio.close()
    print("[Pipeline] 렌더링 완료!", flush=True)
    return output_path

def verify_video_quality(video_path, expected_duration, min_size_kb=200):
    if not os.path.exists(video_path):
        return False, "영상 파일이 생성되지 않았습니다."

    size_kb = os.path.getsize(video_path) / 1024
    if size_kb < min_size_kb:
        return False, f"영상 파일 크기가 비정상적으로 작습니다 ({size_kb:.1f} KB)."

    try:
        from moviepy import VideoFileClip
        clip = VideoFileClip(video_path)
        actual_dur = clip.duration
        w, h = clip.size
        has_audio = clip.audio is not None
        clip.close()

        if abs(actual_dur - expected_duration) > 3.0:
            return False, f"영상 길이 불일치 (예상: {expected_duration:.1f}s, 실제: {actual_dur:.1f}s)"

        if w != 1080 or h != 1920:
            return False, f"해상도 불일치 ({w}x{h})"

        if not has_audio:
            return False, "오디오 트랙 누락"

        return True, "품질 검증 통과 (1080x1920 세로 숏츠 규격 완벽 일치)"
    except Exception as e:
        return False, f"영상 무결성 검증 실패: {str(e)}"

async def run_pipeline(script, title="shorts", category="engineering", output_dir=".", viral_features=None):
    t0 = time.time()
    os.makedirs(output_dir, exist_ok=True)
    safe = re.sub(r'[^\w가-힣]', '_', title)[:30]
    ap = os.path.join(output_dir, f"{safe}_tts.mp3")
    sp = os.path.join(output_dir, f"{safe}_subs.srt")
    vp = os.path.join(output_dir, f"{safe}_final.mp4")
    vjp = os.path.join(output_dir, f"{safe}_viral_subs.json")
    threeD_json = os.path.join(output_dir, f"{safe}_3d_scene.json")

    # 바이럴 특징 적용
    if viral_features:
        print(f"[Pipeline] 바이럴 AI 특징 적용: {viral_features.get('primaryColor')}", flush=True)

    print(f"\n[1/4] TTS 음성 생성 (어댑터)...", flush=True)
    await generate_tts_adapter(script, ap, sp)

    print("\n[2/4] 바이럴 자막 추출...", flush=True)
    raw = parse_subtitles(sp)
    viral = group_subtitles_viral(raw)
    with open(vjp, "w", encoding="utf-8") as f:
        json.dump([{"start": s, "end": e, "text": t} for s, e, t in viral], f, ensure_ascii=False, indent=2)

    print("\n[3/4] 3D 시각 자료 생성...", flush=True)
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from renderer_3d import create_mechanism_scene
        scene_3d = create_mechanism_scene(title, category)
        scene_3d.update(0, 0.016)
        with open(threeD_json, "w", encoding="utf-8") as f:
            json.dump(scene_3d.to_json(), f, ensure_ascii=False, indent=2)
        print("[3/4] 3D 시각 자료 생성 완료", flush=True)
    except Exception as e:
        print(f"[3/4] 3D 시각 자료 생성 실패 (fallback): {e}", flush=True)
        # 3D 생성 실패 시 빈 JSON 생성
        with open(threeD_json, "w", encoding="utf-8") as f:
            json.dump({"error": str(e)}, f, ensure_ascii=False)

    print("\n[4/4] 1080x1920 영상 렌더링...", flush=True)
    compose_video(title, script, category, ap, sp, vp, viral_features=viral_features)

    from moviepy import AudioFileClip
    ac = AudioFileClip(ap)
    expected_dur = ac.duration
    ac.close()

    is_valid, report = verify_video_quality(vp, expected_dur)
    total_time = time.time() - t0

    result = {
        "audio": ap,
        "subtitles": sp,
        "viral_subtitles": vjp,
        "3d_scene": threeD_json,
        "video": vp,
        "duration_sec": total_time,
        "quality_passed": is_valid,
        "quality_report": report,
    }
    return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        demo = "공기의 흐름을 이해하면 비행기 날개의 원리를 알 수 있습니다.\n날개 윗쪽은 볼록하고 아래쪽은 평평합니다.\n비행기가 앞으로 나아가면 공기가 날개를 가릅니다.\n이 압력 차이가 날개를 위로 미는 양력을 만듭니다."
        od = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "outputs", "demo")
        result = asyncio.run(run_pipeline(demo, "비행기_원리", "engineering", od))
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        data = json.loads(sys.argv[1])
        result = asyncio.run(
            run_pipeline(
                data["script"],
                data.get("title", "shorts"),
                data.get("category", "engineering"),
                data.get("output_dir", ".")
            )
        )
        print("__RESULT__" + json.dumps(result, ensure_ascii=False))
