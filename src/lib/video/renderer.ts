// Real-time 3D shorts renderer: canvas scenes + narration + ducked BGM → WebM via MediaRecorder.

import { buildDuckingSchedule, fadeEnvelope, MIX, type GainPoint } from "./audio-mix";
import { renderBgmLoop } from "./bgm";
import { captionAt } from "./captions";
import type { SolidScenes } from "./solid-scenes";
import {
  classifyScript,
  sceneShotIndex,
  splitSentences,
  type ScenePreset,
} from "./scene-classifier";
import { cameraFor, drawBackdrop, drawScene, PALETTES, smoothstep, transitionAt } from "./scenes";
import { drawSubjectScene } from "./subject-scenes";
import {
  buildSceneBlocks,
  buildTimeline,
  segmentIndexAt,
  TIMELINE,
  type Timeline,
} from "./timeline";

/** Layout units: every scene and overlay is drawn in this 720×1280 space. */
export const VIDEO_WIDTH = 720;
export const VIDEO_HEIGHT = 1280;
/** Export is drawn at 1.5× the layout size → 1080×1920 Full HD (YouTube Shorts / Reels native). */
export const RENDER_SCALE = 1.5;
export const EXPORT_WIDTH = VIDEO_WIDTH * RENDER_SCALE;
export const EXPORT_HEIGHT = VIDEO_HEIGHT * RENDER_SCALE;
const FPS = 30;
const VIDEO_BITRATE = 12_000_000;
const AUDIO_BITRATE = 192_000;
const FONT = '"IBM Plex Sans KR", "Space Grotesk", sans-serif';

export interface RenderOptions {
  title: string;
  script: string;
  category: "education" | "engineering";
  /** Field id (e.g. "mechanical-automotive"); sets the default 3D scene. */
  subcategory?: string;
  /** One WAV (or any decodable audio) per sentence, in order. Missing entries render silent. */
  voiceClips?: Array<ArrayBuffer | null>;
  /** Optional on-page canvas to show the render live. */
  canvas?: HTMLCanvasElement;
  onProgress?: (progress: number) => void;
}

export interface RenderResult {
  blob: Blob;
  timeline: Timeline;
  scenes: ScenePreset[];
  durationSec: number;
  hasVoice: boolean;
  width: number;
  height: number;
  frameRate: number;
  videoBitrateBps: number;
}

export interface RenderedVideoMetadata {
  width: number;
  height: number;
  durationSec: number | null;
}

export function validateRenderedVideoMetadata(
  metadata: RenderedVideoMetadata,
  expectedWidth: number,
  expectedHeight: number,
): RenderedVideoMetadata {
  if (
    !Number.isInteger(metadata.width) ||
    !Number.isInteger(metadata.height) ||
    metadata.width <= 0 ||
    metadata.height <= 0
  ) {
    throw new Error("내보낸 영상의 첫 프레임을 읽지 못했습니다.");
  }
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(
      `내보낸 영상 해상도가 예상과 다릅니다 (${metadata.width}×${metadata.height}, 예상 ${expectedWidth}×${expectedHeight}).`,
    );
  }
  if (
    metadata.durationSec !== null &&
    (!Number.isFinite(metadata.durationSec) || metadata.durationSec <= 0)
  ) {
    throw new Error("내보낸 영상의 재생 시간을 읽지 못했습니다.");
  }
  return metadata;
}

function inspectRecordedVideo(
  blob: Blob,
  expectedWidth: number,
  expectedHeight: number,
): Promise<RenderedVideoMetadata> {
  if (typeof document === "undefined" || blob.size === 0) {
    return Promise.reject(new Error("생성된 영상 데이터를 검증할 수 없습니다."));
  }

  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(blob);
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("error", handleError);
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };
    const handleLoadedData = () => {
      const metadata = {
        width: video.videoWidth,
        height: video.videoHeight,
        durationSec: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null,
      };
      try {
        validateRenderedVideoMetadata(metadata, expectedWidth, expectedHeight);
        cleanup();
        resolve(metadata);
      } catch (error) {
        fail(error instanceof Error ? error : new Error("영상 검증에 실패했습니다."));
      }
    };
    const handleError = () => {
      fail(new Error("생성한 영상 파일을 브라우저에서 재생할 수 없습니다."));
    };

    video.addEventListener("loadeddata", handleLoadedData, { once: true });
    video.addEventListener("error", handleError, { once: true });
    const timeoutId = window.setTimeout(() => {
      fail(new Error("생성한 영상의 재생 검증 시간이 초과되었습니다."));
    }, 20_000);
    video.src = objectUrl;
    video.load();
  });
}

/** Plan the video without rendering (used for the scene preview list). */
export function planVideo(
  title: string,
  script: string,
  category: "education" | "engineering",
  subcategory?: string,
) {
  const sentences = splitSentences(script);
  const list = sentences.length > 0 ? sentences : [title];
  const scenes = classifyScript(list, { title, category, subcategory });
  return { sentences: list, scenes, timeline: buildTimeline(list, scenes) };
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  // Korean has no spaces inside words, so fall back to per-character wrapping for long tokens.
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  const push = (w: string) => {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else current = test;
  };
  for (const word of words) {
    if (ctx.measureText(word).width > maxWidth) {
      for (const ch of word) {
        const test = current + ch;
        if (ctx.measureText(test).width > maxWidth && current) {
          lines.push(current);
          current = ch;
        } else current = test;
      }
    } else push(word);
  }
  if (current) lines.push(current);
  return lines;
}

function applyAutomation(param: AudioParam, points: GainPoint[], t0: number) {
  param.cancelScheduledValues(0);
  param.setValueAtTime(points[0]?.value ?? 0, t0);
  for (const p of points.slice(1)) param.linearRampToValueAtTime(p.value, t0 + p.time);
}

/** 0..1 share of the caption already spoken (voice clip time, or reading time when silent). */
function captionProgress(seg: Timeline["segments"][number], t: number) {
  const s0 = seg.voiceStart ?? seg.start;
  const s1 = seg.voiceEnd ?? Math.max(s0 + 0.5, seg.end - TIMELINE.gapSec - 0.2);
  return Math.min(1, Math.max(0, (t - s0) / (s1 - s0)));
}

function drawOverlay(ctx: CanvasRenderingContext2D, title: string, timeline: Timeline, t: number) {
  const seg = timeline.segments[segmentIndexAt(timeline, t)];
  ctx.save();
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  // The subject fills the screen; no neon panels, waveform, or permanent title obstruction.
  if (t < timeline.introSec && t > 0.1) {
    ctx.font = `800 40px ${FONT}`;
    const lines = wrapText(ctx, title, VIDEO_WIDTH - 100);
    lines.forEach((line, i) => {
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#10151a";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(line, VIDEO_WIDTH / 2, 180 + i * 50);
      ctx.fillText(line, VIDEO_WIDTH / 2, 180 + i * 50);
    });
  }
  if (seg && t >= seg.start && t < seg.end) {
    const phrase = captionAt(seg.text, captionProgress(seg, t));
    ctx.font = `800 44px ${FONT}`;
    const lines = wrapText(ctx, phrase, VIDEO_WIDTH - 110);
    lines.forEach((line, i) => {
      const y = VIDEO_HEIGHT * 0.75 + i * 54;
      ctx.lineWidth = 8;
      ctx.strokeStyle = "#10151a";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(line, VIDEO_WIDTH / 2, y);
      ctx.fillText(line, VIDEO_WIDTH / 2, y);
    });
  }
  ctx.restore();
}

function drawTransitionDip(
  ctx: CanvasRenderingContext2D,
  blocks: ReturnType<typeof buildSceneBlocks>,
  t: number,
) {
  const half = TIMELINE.transitionSec / 2;
  const boundary = blocks.slice(0, -1).find((block) => Math.abs(t - block.end) < half);
  if (!boundary) return;
  const transition = transitionAt(t, boundary.end, TIMELINE.transitionSec);
  const alpha = 0.35 * Math.sin(Math.PI * transition.progress);
  if (alpha <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
}

function drawEdgeFades(ctx: CanvasRenderingContext2D, timeline: Timeline, t: number) {
  const fadeIn = Math.max(0, 1 - t / 0.6);
  const fadeOut = Math.max(0, 1 - (timeline.totalSec - t) / 0.8);
  const fade = Math.max(fadeIn, fadeOut);
  if (fade <= 0) return;
  ctx.fillStyle = `rgba(0,0,0,${fade})`;
  ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  title: string,
  timeline: Timeline,
  t: number,
  solid?: SolidScenes,
  subcategory?: string,
) {
  const W = VIDEO_WIDTH;
  const H = VIDEO_HEIGHT;
  const blocks = buildSceneBlocks(timeline);
  if (blocks.length === 0) return;
  // Draw in 720×1280 layout units at whatever resolution the canvas really has.
  const cw = (ctx.canvas as HTMLCanvasElement | undefined)?.width;
  const k = typeof cw === "number" && cw > 0 ? cw / W : 1;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  const segment = timeline.segments[segmentIndexAt(timeline, t)];
  const shot = sceneShotIndex(`${title} ${segment?.text ?? ""}`, segment?.index ?? 0);
  if (solid && segment) {
    solid.draw(
      ctx,
      segment.scene,
      segment.text,
      Math.max(0, t - segment.start),
      segment.index,
      subcategory,
    );
    drawTransitionDip(ctx, blocks, t);
    drawOverlay(ctx, title, timeline, t);
    drawEdgeFades(ctx, timeline, t);
    return;
  }
  const half = TIMELINE.transitionSec / 2;
  let bi = blocks.findIndex((b) => t < b.end);
  if (bi === -1) bi = blocks.length - 1;

  // Which boundary (if any) are we crossing?
  let from = bi;
  let to = -1;
  if (bi < blocks.length - 1 && t > blocks[bi].end - half) to = bi + 1;
  else if (bi > 0 && t < blocks[bi].start + half) {
    from = bi - 1;
    to = bi;
  }

  const a = blocks[from];
  const camA = cameraFor(a.scene, t - a.start, W, H, shot);
  if (to === -1) {
    drawBackdrop(ctx, W, H, PALETTES[a.scene], 1);
    drawScene(ctx, a.scene, camA, t - a.start, 1);
  } else {
    const b = blocks[to];
    const tr = transitionAt(t, a.end, TIMELINE.transitionSec);
    const camB = cameraFor(b.scene, t - b.start, W, H, shot);
    drawBackdrop(ctx, W, H, PALETTES[a.scene], 1);
    drawBackdrop(ctx, W, H, PALETTES[b.scene], tr.inAlpha);
    drawScene(
      ctx,
      a.scene,
      { ...camA, dist: camA.dist * tr.outDolly, yaw: camA.yaw + tr.outYaw },
      t - a.start,
      tr.outAlpha,
    );
    drawScene(
      ctx,
      b.scene,
      { ...camB, dist: camB.dist * tr.inDolly, yaw: camB.yaw + tr.inYaw },
      t - b.start,
      tr.inAlpha,
    );
    // brief dip so the cut reads as a fade
    ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.sin(Math.PI * tr.progress)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawSubjectScene(ctx, subcategory, segment?.text ?? title, t, shot);
  drawOverlay(ctx, title, timeline, t);

  drawEdgeFades(ctx, timeline, t);
}

/**
 * Average milliseconds per displayed frame while drawing at the canvas's current size.
 * Uses animation-frame timing (no pixel read-back, which would slow the canvas down).
 */
function benchmarkFrame(
  ctx: CanvasRenderingContext2D,
  title: string,
  timeline: Timeline,
  solid?: SolidScenes,
  subcategory?: string,
) {
  return new Promise<number>((resolve) => {
    const frames = 12;
    const span = Math.min(timeline.totalSec, 6);
    let i = 0;
    let start = 0;
    const step = (now: number) => {
      if (i === 2) start = now; // skip warm-up frames
      drawFrame(ctx, title, timeline, (span * (i + 1)) / (frames + 1), solid, subcategory);
      i++;
      if (i <= frames) requestAnimationFrame(step);
      else resolve((now - start) / (frames - 2));
    };
    requestAnimationFrame(step);
  });
}

export async function renderBrowserVideo(opts: RenderOptions): Promise<RenderResult> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error(
      "이 브라우저는 영상 녹화를 지원하지 않습니다. Chrome 또는 Edge 브라우저를 사용해주세요.",
    );
  }
  const { title, script, category, subcategory, voiceClips, onProgress } = opts;

  const canvas = opts.canvas ?? document.createElement("canvas");
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext("2d", { alpha: false }) ?? canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") {
    throw new Error("3D 그래픽 캔버스를 초기화할 수 없습니다.");
  }
  try {
    await Promise.all([
      document.fonts.load(`800 42px "IBM Plex Sans KR"`),
      document.fonts.load(`900 46px "IBM Plex Sans KR"`),
      document.fonts.load(`700 18px "IBM Plex Sans KR"`),
    ]);
  } catch {
    /* fall back to system fonts */
  }

  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  if (audioCtx.state === "suspended") await audioCtx.resume();

  const { sentences, scenes } = planVideo(title, script, category, subcategory);

  // Decode narration clips to learn exact durations.
  const voiceBuffers: Array<AudioBuffer | null> = [];
  for (let i = 0; i < sentences.length; i++) {
    const clip = voiceClips?.[i];
    if (!clip) {
      voiceBuffers.push(null);
      continue;
    }
    try {
      voiceBuffers.push(await audioCtx.decodeAudioData(clip.slice(0)));
    } catch {
      voiceBuffers.push(null);
    }
  }
  const hasVoice = voiceBuffers.some(Boolean);
  const timeline = buildTimeline(
    sentences,
    scenes,
    hasVoice ? voiceBuffers.map((b) => (b ? b.duration : null)) : undefined,
  );
  const total = timeline.totalSec;

  // Devices that cannot draw Full HD in real time (~30 fps) record at 720×1280 instead,
  // so the video stays smooth rather than stuttering.
  const { createSolidScenes, supportsWebGL } = await import("./solid-scenes");
  let solid: SolidScenes | undefined;
  if (supportsWebGL()) {
    try {
      solid = createSolidScenes(EXPORT_WIDTH, EXPORT_HEIGHT);
    } catch {
      // Keep video export available on browsers without WebGL by using the canvas renderer.
    }
  }
  const frameMs = await benchmarkFrame(ctx, title, timeline, solid, subcategory);
  const fullHd = frameMs <= 40;
  const videoBitrateBps = fullHd ? VIDEO_BITRATE : 8_000_000;
  if (!fullHd) {
    canvas.width = VIDEO_WIDTH;
    canvas.height = VIDEO_HEIGHT;
  }

  // --- audio graph ---------------------------------------------------------
  const dest = audioCtx.createMediaStreamDestination();
  const compressor = audioCtx.createDynamicsCompressor();
  compressor.threshold.value = -10;
  compressor.knee.value = 6;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.15;
  compressor.connect(dest);

  const bgm = await renderBgmLoop(audioCtx.sampleRate, category);
  const bgmBuffer = audioCtx.createBuffer(
    bgm.channels.length,
    bgm.channels[0].length,
    bgm.sampleRate,
  );
  bgm.channels.forEach((data, c) => bgmBuffer.copyToChannel(data as Float32Array<ArrayBuffer>, c));
  const bgmSource = audioCtx.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true;

  let node: AudioNode = bgmSource;
  for (const band of MIX.speechEq) {
    const eq = audioCtx.createBiquadFilter();
    eq.type = "peaking";
    eq.frequency.value = band.frequency;
    eq.gain.value = band.gainDb;
    eq.Q.value = band.q;
    node.connect(eq);
    node = eq;
  }
  const duck = audioCtx.createGain();
  const fade = audioCtx.createGain();
  node.connect(duck).connect(fade).connect(compressor);

  const voiceHp = audioCtx.createBiquadFilter();
  voiceHp.type = "highpass";
  voiceHp.frequency.value = MIX.voiceHighpassHz;
  const presence = audioCtx.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = MIX.voicePresence.frequency;
  presence.gain.value = MIX.voicePresence.gainDb;
  presence.Q.value = MIX.voicePresence.q;
  const voiceGain = audioCtx.createGain();
  voiceGain.gain.value = 0.95;
  voiceHp.connect(presence).connect(voiceGain).connect(compressor);

  const voiceIntervals = timeline.segments
    .filter((s) => s.voiceStart != null && s.voiceEnd != null)
    .map((s) => ({ start: s.voiceStart as number, end: s.voiceEnd as number }));

  // --- recording -------------------------------------------------------------
  const videoStream = canvas.captureStream(FPS);
  const stream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  // H.264 MP4 first (saves to the phone gallery, plays on iPhone); then WebM; bare MP4 for Safari.
  const mimeType =
    [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1,mp4a.40.2",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4", // Safari / iPhone (records H.264)
    ].find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: videoBitrateBps,
    audioBitsPerSecond: AUDIO_BITRATE,
  });
  const chunks: BlobPart[] = [];
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    recorder.onerror = () => reject(new Error("3D 영상 녹화 중 인코더 오류가 발생했습니다."));
    recorder.onstop = () =>
      resolve(new Blob(chunks, { type: mimeType || recorder.mimeType || "video/mp4" }));
  });

  drawFrame(ctx, title, timeline, 0, solid, subcategory);
  recorder.start(500);
  const t0 = audioCtx.currentTime + 0.15;
  applyAutomation(duck.gain, buildDuckingSchedule(voiceIntervals, total), t0);
  applyAutomation(fade.gain, fadeEnvelope(total), t0);
  bgmSource.start(t0);
  bgmSource.stop(t0 + total + 0.05);
  const voiceSources: AudioBufferSourceNode[] = [];
  timeline.segments.forEach((seg) => {
    const buf = voiceBuffers[seg.index];
    if (!buf || seg.voiceStart == null) return;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(voiceHp);
    src.start(t0 + seg.voiceStart);
    voiceSources.push(src);
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const frame = () => {
        if (recorder.state !== "recording") {
          reject(new Error("영상 인코딩이 중단되었습니다."));
          return;
        }
        const t = Math.max(0, audioCtx.currentTime - t0);
        drawFrame(ctx, title, timeline, Math.min(t, total), solid, subcategory);
        onProgress?.(Math.min(1, t / total));
        if (t >= total) {
          setTimeout(() => {
            if (recorder.state === "recording") recorder.stop();
            resolve();
          }, 120);
        } else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const blob = await done;
    if (blob.size === 0) throw new Error("생성된 영상 데이터가 비어 있습니다.");
    const metadata = await inspectRecordedVideo(blob, canvas.width, canvas.height);
    return {
      blob,
      timeline,
      scenes,
      durationSec: metadata.durationSec ?? total,
      hasVoice,
      width: metadata.width,
      height: metadata.height,
      frameRate: FPS,
      videoBitrateBps,
    };
  } finally {
    solid?.dispose();
    if (recorder.state === "recording") recorder.stop();
    voiceSources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    stream.getTracks().forEach((tr) => tr.stop());
    try {
      await audioCtx.close();
    } catch {
      /* ignore */
    }
  }
}
