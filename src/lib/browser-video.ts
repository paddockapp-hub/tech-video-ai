export interface BrowserVideoOptions {
  title: string;
  script: string;
  category: "education" | "engineering";
  durationSec: number;
  onProgress?: (progress: number) => void;
}

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 24;

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let line = "";

  for (const character of text) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function drawFrame(
  context: CanvasRenderingContext2D,
  title: string,
  segments: string[],
  category: "education" | "engineering",
  elapsed: number,
  duration: number
) {
  const progress = Math.min(1, elapsed / duration);
  const accent = category === "engineering" ? "#38bdf8" : "#fbbf24";
  const background = context.createLinearGradient(0, 0, WIDTH, HEIGHT);
  background.addColorStop(0, "#07111f");
  background.addColorStop(0.55, "#111827");
  background.addColorStop(1, "#172554");
  context.fillStyle = background;
  context.fillRect(0, 0, WIDTH, HEIGHT);

  context.save();
  context.globalAlpha = 0.18;
  context.strokeStyle = "#64748b";
  context.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 72) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, HEIGHT);
    context.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 72) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(WIDTH, y);
    context.stroke();
  }
  context.restore();

  context.fillStyle = accent;
  context.beginPath();
  context.roundRect(54, 82, 236, 48, 24);
  context.fill();
  context.fillStyle = "#07111f";
  context.font = "700 20px sans-serif";
  context.textAlign = "center";
  context.fillText(category === "engineering" ? "ENGINEERING" : "LEARNING", 172, 113);

  context.textAlign = "left";
  context.fillStyle = "#f8fafc";
  context.font = "700 46px sans-serif";
  const titleLines = wrapText(context, title, WIDTH - 108).slice(0, 3);
  titleLines.forEach((line, index) => {
    context.fillText(line, 54, 202 + index * 58);
  });
  context.strokeStyle = accent;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(54, 226 + titleLines.length * 58);
  context.lineTo(WIDTH - 54, 226 + titleLines.length * 58);
  context.stroke();

  const centerX = WIDTH / 2;
  const centerY = 620;
  const angle = elapsed * 1.5;
  context.strokeStyle = "#94a3b8";
  context.lineWidth = 3;
  context.beginPath();
  context.arc(centerX, centerY, 170, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = accent;
  context.beginPath();
  context.arc(centerX, centerY, 112, -angle, angle + Math.PI * 1.4);
  context.stroke();
  context.fillStyle = accent;
  context.beginPath();
  context.arc(
    centerX + Math.cos(angle) * 170,
    centerY + Math.sin(angle) * 170,
    14,
    0,
    Math.PI * 2
  );
  context.fill();
  context.beginPath();
  context.arc(centerX, centerY, 22, 0, Math.PI * 2);
  context.fill();

  const segmentIndex = Math.min(
    segments.length - 1,
    Math.floor(progress * segments.length)
  );
  const caption = segments[segmentIndex] ?? "";
  context.font = "600 34px sans-serif";
  const captionLines = wrapText(context, caption, WIDTH - 144).slice(0, 4);
  const captionY = 914;
  const boxHeight = Math.max(104, captionLines.length * 48 + 48);
  context.fillStyle = "rgba(2, 6, 23, 0.86)";
  context.beginPath();
  context.roundRect(48, captionY, WIDTH - 96, boxHeight, 24);
  context.fill();
  context.strokeStyle = accent;
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#f8fafc";
  context.textAlign = "center";
  captionLines.forEach((line, index) => {
    context.fillText(line, centerX, captionY + 58 + index * 48);
  });

  context.fillStyle = "#94a3b8";
  context.font = "500 18px sans-serif";
  context.fillText("BROWSER RENDER · NO AI VOICE", centerX, HEIGHT - 62);
  context.fillStyle = "#334155";
  context.fillRect(0, HEIGHT - 12, WIDTH, 12);
  context.fillStyle = accent;
  context.fillRect(0, HEIGHT - 12, WIDTH * progress, 12);
}

export async function renderBrowserVideo({
  title,
  script,
  category,
  durationSec,
  onProgress,
}: BrowserVideoOptions): Promise<Blob> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("이 브라우저는 영상 녹화를 지원하지 않습니다. 최신 Chrome 또는 Edge를 사용해주세요.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.captureStream !== "function") {
    throw new Error("브라우저에서 영상 캔버스를 초기화할 수 없습니다.");
  }

  const mimeType = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    throw new Error("이 브라우저는 WebM 영상 인코딩을 지원하지 않습니다.");
  }

  const segments = script
    .replace(/([.!?。！？])\s*/g, "$1\n")
    .split(/\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    throw new Error("영상에 넣을 대본을 입력해주세요.");
  }

  const duration = Math.max(1, Math.min(45, Math.floor(durationSec)));
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  });
  const chunks: BlobPart[] = [];
  const recording = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("브라우저 영상 인코딩 중 오류가 발생했습니다."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  recording.catch(() => undefined);

  const startedAt = performance.now();
  try {
    recorder.start(500);
    await new Promise<void>((resolve, reject) => {
      const renderNextFrame = () => {
        if (recorder.state !== "recording") {
          reject(new Error("브라우저 영상 녹화가 예상치 못하게 중단되었습니다."));
          return;
        }

        const elapsed = (performance.now() - startedAt) / 1000;
        drawFrame(context, title, segments, category, elapsed, duration);
        onProgress?.(Math.min(1, elapsed / duration));

        if (elapsed >= duration) {
          recorder.stop();
          resolve();
        } else {
          requestAnimationFrame(renderNextFrame);
        }
      };
      requestAnimationFrame(renderNextFrame);
    });

    const blob = await recording;
    if (blob.size === 0) {
      throw new Error("생성된 영상 데이터가 비어 있습니다. 다시 시도해주세요.");
    }
    return blob;
  } finally {
    if (recorder.state === "recording") recorder.stop();
    stream.getTracks().forEach((track) => track.stop());
  }
}
