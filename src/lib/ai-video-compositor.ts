import {
  BROWSER_VIDEO_SPEC,
  createSynthesizedAudioStream,
} from "@/lib/browser-video";
import {
  AI_VIDEO_CLIP_COUNT,
  AI_VIDEO_CLIP_DURATION_SEC,
} from "@/lib/ai-video-config";

interface ComposeSeedanceVideoOptions {
  clips: Blob[];
  title: string;
  captions: string[];
  onProgress?: (progress: number) => void;
}

interface LoadedVideo {
  element: HTMLVideoElement;
  objectUrl: string;
}

function loadVideoClip(blob: Blob): Promise<LoadedVideo> {
  const objectUrl = URL.createObjectURL(blob);
  const element = document.createElement("video");
  element.preload = "auto";
  element.muted = true;
  element.playsInline = true;
  element.setAttribute("aria-hidden", "true");
  element.tabIndex = -1;
  element.style.position = "fixed";
  element.style.width = "1px";
  element.style.height = "1px";
  element.style.opacity = "0";
  element.style.pointerEvents = "none";

  return new Promise((resolve, reject) => {
    let timeoutId = 0;
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      element.removeEventListener("loadeddata", handleLoadedData);
      element.removeEventListener("error", handleError);
    };
    const fail = (message: string) => {
      cleanup();
      element.pause();
      element.removeAttribute("src");
      element.load();
      element.remove();
      URL.revokeObjectURL(objectUrl);
      reject(new Error(message));
    };
    const handleLoadedData = () => {
      cleanup();
      if (element.videoWidth <= 0 || element.videoHeight <= 0) {
        fail("AI 클립의 영상 프레임을 읽을 수 없습니다.");
        return;
      }
      document.body.appendChild(element);
      resolve({ element, objectUrl });
    };
    const handleError = () => {
      fail("AI 클립을 브라우저에서 재생할 수 없습니다.");
    };

    timeoutId = window.setTimeout(() => {
      fail("AI 클립을 브라우저에서 디코딩하는 시간이 초과되었습니다.");
    }, 30_000);
    element.addEventListener("loadeddata", handleLoadedData, { once: true });
    element.addEventListener("error", handleError, { once: true });
    element.src = objectUrl;
    element.load();
  });
}

function drawCover(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const sourceRatio = video.videoWidth / video.videoHeight;
  const targetRatio = width / height;

  if (sourceRatio > targetRatio) {
    const sourceWidth = video.videoHeight * targetRatio;
    const sourceX = (video.videoWidth - sourceWidth) / 2;
    context.drawImage(
      video,
      sourceX,
      0,
      sourceWidth,
      video.videoHeight,
      0,
      0,
      width,
      height,
    );
    return;
  }

  const sourceHeight = video.videoWidth / targetRatio;
  const sourceY = (video.videoHeight - sourceHeight) / 2;
  context.drawImage(
    video,
    0,
    sourceY,
    video.videoWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
}

function wrapCaption(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
) {
  const lines = [""];
  for (const character of Array.from(text.trim())) {
    const lastLine = lines.length - 1;
    const candidate = `${lines[lastLine]}${character}`;
    if (lines[lastLine] && context.measureText(candidate).width > maxWidth) {
      if (lines.length === maxLines) {
        lines[lastLine] = `${lines[lastLine].trimEnd()}…`;
        break;
      }
      lines.push(character.trim() ? character : "");
    } else {
      lines[lastLine] = candidate;
    }
  }
  return lines.map((line) => line.trim()).filter(Boolean);
}

function drawOverlays(
  context: CanvasRenderingContext2D,
  title: string,
  caption: string,
  sceneNumber: number,
) {
  const { width, height } = BROWSER_VIDEO_SPEC;
  const topGradient = context.createLinearGradient(0, 0, 0, 310);
  topGradient.addColorStop(0, "rgba(2, 6, 23, 0.82)");
  topGradient.addColorStop(1, "rgba(2, 6, 23, 0)");
  context.fillStyle = topGradient;
  context.fillRect(0, 0, width, 310);

  context.fillStyle = "#67e8f9";
  context.font = '700 26px "Inter", "Noto Sans KR", sans-serif';
  context.textAlign = "left";
  context.fillText(`AI CINEMATIC · SCENE 0${sceneNumber}`, 64, 82);

  context.fillStyle = "#ffffff";
  context.font = '800 50px "Inter", "Noto Sans KR", sans-serif';
  const titleLines = wrapCaption(context, title, width - 128, 2);
  titleLines.forEach((line, index) => context.fillText(line, 64, 154 + index * 64));

  const bottomHeight = 390;
  const bottomY = height - bottomHeight;
  const bottomGradient = context.createLinearGradient(0, bottomY, 0, height);
  bottomGradient.addColorStop(0, "rgba(2, 6, 23, 0)");
  bottomGradient.addColorStop(0.22, "rgba(2, 6, 23, 0.76)");
  bottomGradient.addColorStop(1, "rgba(2, 6, 23, 0.94)");
  context.fillStyle = bottomGradient;
  context.fillRect(0, bottomY, width, bottomHeight);

  context.fillStyle = "#67e8f9";
  context.font = '800 25px "Inter", "Noto Sans KR", sans-serif';
  context.fillText("핵심 장면", 64, height - 270);
  context.fillStyle = "#ffffff";
  context.font = '700 48px "Inter", "Noto Sans KR", sans-serif';
  const captionLines = wrapCaption(context, caption, width - 128, 3);
  captionLines.forEach((line, index) =>
    context.fillText(line, 64, height - 195 + index * 62),
  );
}

function waitForRecorder(recorder: MediaRecorder, chunks: BlobPart[]) {
  return new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("AI 영상 합성 중 브라우저 인코더 오류가 발생했습니다."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });
}

function renderClip(
  video: HTMLVideoElement,
  context: CanvasRenderingContext2D,
  title: string,
  caption: string,
  sceneNumber: number,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let frameId = 0;
    const startedAt = performance.now();
    const timeoutId = window.setTimeout(() => {
      cancelAnimationFrame(frameId);
      video.pause();
      reject(new Error(`AI 클립 ${sceneNumber}/${AI_VIDEO_CLIP_COUNT} 재생 시간이 초과되었습니다.`));
    }, 45_000);

    const finish = (error?: Error) => {
      window.clearTimeout(timeoutId);
      cancelAnimationFrame(frameId);
      video.pause();
      if (error) reject(error);
      else resolve();
    };

    const renderFrame = () => {
      try {
        const elapsed = (performance.now() - startedAt) / 1000;
        context.clearRect(0, 0, BROWSER_VIDEO_SPEC.width, BROWSER_VIDEO_SPEC.height);
        drawCover(context, video, BROWSER_VIDEO_SPEC.width, BROWSER_VIDEO_SPEC.height);
        drawOverlays(context, title, caption, sceneNumber);
        const segmentProgress = Math.min(1, elapsed / AI_VIDEO_CLIP_DURATION_SEC);
        onProgress((sceneNumber - 1 + segmentProgress) / AI_VIDEO_CLIP_COUNT);

        if (elapsed >= AI_VIDEO_CLIP_DURATION_SEC) {
          finish();
          return;
        }
        frameId = requestAnimationFrame(renderFrame);
      } catch {
        finish(new Error(`AI 클립 ${sceneNumber}/${AI_VIDEO_CLIP_COUNT} 합성 중 오류가 발생했습니다.`));
      }
    };

    video.currentTime = 0;
    video.play().then(() => {
      frameId = requestAnimationFrame(renderFrame);
    }).catch(() => {
      finish(new Error(`AI 클립 ${sceneNumber}/${AI_VIDEO_CLIP_COUNT} 재생을 시작하지 못했습니다.`));
    });
  });
}

export async function composeSeedanceVideo({
  clips,
  title,
  captions,
  onProgress,
}: ComposeSeedanceVideoOptions): Promise<Blob> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("이 브라우저는 영상 합성을 지원하지 않습니다. Chrome 또는 Edge 브라우저를 사용해주세요.");
  }
  if (clips.length !== AI_VIDEO_CLIP_COUNT) {
    throw new Error("완성 영상에는 AI 클립 3개가 필요합니다.");
  }

  const loadedVideos: LoadedVideo[] = [];
  const canvas = document.createElement("canvas");
  canvas.width = BROWSER_VIDEO_SPEC.width;
  canvas.height = BROWSER_VIDEO_SPEC.height;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") {
    throw new Error("1080p 영상 합성용 캔버스를 초기화할 수 없습니다.");
  }

  const mimeType = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";

  let audioContext: AudioContext | null = null;
  let combinedStream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let recordingPromise: Promise<Blob> | null = null;

  try {
    for (const clip of clips) {
      loadedVideos.push(await loadVideoClip(clip));
    }

    const videoStream = canvas.captureStream(BROWSER_VIDEO_SPEC.frameRate);
    combinedStream = videoStream;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        if (audioContext.state === "suspended") {
          await audioContext.resume().catch(() => undefined);
        }
        if (audioContext.state === "running") {
          const audioStream = createSynthesizedAudioStream(
            audioContext,
            AI_VIDEO_CLIP_COUNT * AI_VIDEO_CLIP_DURATION_SEC,
          );
          combinedStream = new MediaStream([
            ...videoStream.getVideoTracks(),
            ...audioStream.getAudioTracks(),
          ]);
        }
      }
    } catch {
      combinedStream = videoStream;
    }

    recorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: BROWSER_VIDEO_SPEC.videoBitsPerSecond,
      audioBitsPerSecond: BROWSER_VIDEO_SPEC.audioBitsPerSecond,
    });
    const chunks: BlobPart[] = [];
    recordingPromise = waitForRecorder(recorder, chunks);
    recorder.start(250);

    for (let index = 0; index < loadedVideos.length; index += 1) {
      const video = loadedVideos[index].element;
      const caption = captions[index] || title;
      await renderClip(
        video,
        context,
        title,
        caption,
        index + 1,
        (progress) => onProgress?.(progress),
      );
    }

    recorder.stop();
    const blob = await recordingPromise;
    if (blob.size === 0) {
      throw new Error("AI 영상 합성 결과가 비어 있습니다.");
    }
    return blob;
  } catch (error) {
    if (recorder?.state === "recording") recorder.stop();
    if (recordingPromise) await recordingPromise.catch(() => undefined);
    throw error instanceof Error ? error : new Error("AI 영상 합성 중 알 수 없는 오류가 발생했습니다.");
  } finally {
    loadedVideos.forEach(({ element, objectUrl }) => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      element.remove();
      URL.revokeObjectURL(objectUrl);
    });
    combinedStream?.getTracks().forEach((track) => track.stop());
    if (audioContext) {
      await audioContext.close().catch(() => undefined);
    }
  }
}
