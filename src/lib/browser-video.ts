// =============================================================================
// Real 3D Cinematic Shorts Video Renderer (Canvas 3D Engine + Web Audio Synthesizer)
// =============================================================================

export interface BrowserVideoOptions {
  title: string;
  script: string;
  category: "education" | "engineering";
  durationSec: number;
  onProgress?: (progress: number) => void;
}

const WIDTH = 720;
const HEIGHT = 1280;
const FPS = 30;

// 3D Vector & Math Helpers
interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function rotateX(v: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x, y: v.y * cos - v.z * sin, z: v.y * sin + v.z * cos };
}

function rotateY(v: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos + v.z * sin, y: v.y, z: -v.x * sin + v.z * cos };
}

function rotateZ(v: Vec3, angle: number): Vec3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos, z: v.z };
}

function project3D(v: Vec3, width: number, height: number, fov: number = 500, cameraDist: number = 600): { x: number; y: number; scale: number; depth: number } {
  const z = v.z + cameraDist;
  const scale = fov / Math.max(10, z);
  return {
    x: width / 2 + v.x * scale,
    y: height / 2 + v.y * scale,
    scale,
    depth: z,
  };
}

// 3D Particles
interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
}

function initParticles(count = 100): Particle3D[] {
  const colors = ["#38bdf8", "#818cf8", "#c084fc", "#34d399", "#3b82f6"];
  const particles: Particle3D[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 1200,
      z: (Math.random() - 0.5) * 800,
      vx: (Math.random() - 0.5) * 15,
      vy: (Math.random() - 0.5) * 15,
      vz: (Math.random() - 0.5) * 20,
      size: Math.random() * 3 + 1.5,
      color: colors[Math.floor(Math.random() * colors.length)],
    });
  }
  return particles;
}

// 3D Mesh Definitions
function createCubeVertices(size: number): Vec3[] {
  const s = size / 2;
  return [
    { x: -s, y: -s, z: -s },
    { x: s, y: -s, z: -s },
    { x: s, y: s, z: -s },
    { x: -s, y: s, z: -s },
    { x: -s, y: -s, z: s },
    { x: s, y: -s, z: s },
    { x: s, y: s, z: s },
    { x: -s, y: s, z: s },
  ];
}

const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

// 자막 줄바꿈
function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * 3D 메인 렌더링 함수
 */
function draw3DScene(
  ctx: CanvasRenderingContext2D,
  title: string,
  segments: string[],
  category: "education" | "engineering",
  elapsed: number,
  duration: number,
  particles: Particle3D[]
) {
  const progress = Math.min(1, elapsed / duration);
  const isEng = category === "engineering";
  const primaryColor = isEng ? "#00f0ff" : "#ffd700";
  const secondaryColor = isEng ? "#6366f1" : "#ff007f";

  // 1. 딥 사이버/스페이스 그라디언트 배경
  const bg = ctx.createRadialGradient(
    WIDTH / 2, HEIGHT / 2, 50,
    WIDTH / 2, HEIGHT / 2, 900
  );
  bg.addColorStop(0, isEng ? "#071326" : "#1a0b2e");
  bg.addColorStop(0.5, "#060913");
  bg.addColorStop(1, "#020408");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 2. 3D 원근 그리드 바닥 (Cyber Grid)
  ctx.save();
  ctx.lineWidth = 1.2;
  const horizonY = HEIGHT * 0.72;
  const gridPitch = 0.55;
  for (let z = 100; z <= 800; z += 90) {
    const zOffset = (z - (elapsed * 120) % 90);
    const p1 = project3D({ x: -450, y: 350, z: zOffset }, WIDTH, HEIGHT, 450, 400);
    const p2 = project3D({ x: 450, y: 350, z: zOffset }, WIDTH, HEIGHT, 450, 400);
    const alpha = Math.max(0, 1 - zOffset / 800) * 0.25;
    ctx.strokeStyle = isEng ? `rgba(0, 240, 255, ${alpha})` : `rgba(255, 0, 127, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  for (let x = -400; x <= 400; x += 100) {
    const p1 = project3D({ x, y: 350, z: 100 }, WIDTH, HEIGHT, 450, 400);
    const p2 = project3D({ x: x * 1.8, y: 350, z: 800 }, WIDTH, HEIGHT, 450, 400);
    ctx.strokeStyle = isEng ? "rgba(0, 240, 255, 0.12)" : "rgba(255, 0, 127, 0.12)";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  ctx.restore();

  // 3. 3D 파티클 필드 업데이트 및 렌더링
  ctx.save();
  for (const p of particles) {
    p.z -= 1.8;
    if (p.z < -300) p.z = 400;
    const projected = project3D(p, WIDTH, HEIGHT, 480, 500);
    if (projected.scale > 0 && projected.x >= 0 && projected.x <= WIDTH && projected.y >= 0 && projected.y <= HEIGHT) {
      const alpha = Math.min(1, Math.max(0.1, 1 - projected.depth / 800));
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, p.size * projected.scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 4. 중앙 핵심 3D 오브젝트 렌더링 (카테고리별 전문 3D 지오메트리)
  const centerY = HEIGHT * 0.46;
  const rotTime = elapsed * 1.2;

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = primaryColor;

  if (isEng) {
    // -------------------------------------------------------------------------
    // [공학] 3D 인터로킹 큐브 & 메커니즘 코어 (High-Tech 3D Core)
    // -------------------------------------------------------------------------
    const outerVerts = createCubeVertices(240).map((v) => {
      let rot = rotateY(v, rotTime);
      rot = rotateX(rot, rotTime * 0.6);
      rot = rotateZ(rot, rotTime * 0.3);
      rot.y += centerY - HEIGHT / 2;
      return rot;
    });

    const innerVerts = createCubeVertices(130).map((v) => {
      let rot = rotateY(v, -rotTime * 1.5);
      rot = rotateX(rot, -rotTime * 0.8);
      rot.y += centerY - HEIGHT / 2;
      return rot;
    });

    const pOuter = outerVerts.map((v) => project3D(v, WIDTH, HEIGHT, 520, 550));
    const pInner = innerVerts.map((v) => project3D(v, WIDTH, HEIGHT, 520, 550));

    // 외곽 3D 큐브 와이어프레임
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2.8;
    for (const [a, b] of CUBE_EDGES) {
      ctx.beginPath();
      ctx.moveTo(pOuter[a].x, pOuter[a].y);
      ctx.lineTo(pOuter[b].x, pOuter[b].y);
      ctx.stroke();
    }

    // 내부 3D 회전 코어
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    for (const [a, b] of CUBE_EDGES) {
      ctx.beginPath();
      ctx.moveTo(pInner[a].x, pInner[a].y);
      ctx.lineTo(pInner[b].x, pInner[b].y);
      ctx.stroke();
    }

    // 꼭지점 발광 네온 구체들
    for (const p of pOuter) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 * p.scale, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3D 궤도 링 3축 회전
    for (let r = 0; r < 2; r++) {
      ctx.strokeStyle = r === 0 ? "rgba(0, 240, 255, 0.45)" : "rgba(168, 85, 247, 0.45)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const ringAngle = rotTime * (r === 0 ? 1 : -1.2);
      for (let theta = 0; theta <= Math.PI * 2; theta += 0.1) {
        const rx = Math.cos(theta) * (180 + r * 30);
        const ry = Math.sin(theta) * (180 + r * 30);
        let rv: Vec3 = { x: rx, y: 0, z: ry };
        rv = rotateX(rv, 0.8 + r * 0.5);
        rv = rotateY(rv, ringAngle);
        rv.y += centerY - HEIGHT / 2;
        const pp = project3D(rv, WIDTH, HEIGHT, 520, 550);
        if (theta === 0) ctx.moveTo(pp.x, pp.y);
        else ctx.lineTo(pp.x, pp.y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  } else {
    // -------------------------------------------------------------------------
    // [교육] 3D 보어 원자 모형 & 양자 궤도 (Quantum 3D Atom Model)
    // -------------------------------------------------------------------------
    const nucleusPos = project3D({ x: 0, y: centerY - HEIGHT / 2, z: 0 }, WIDTH, HEIGHT, 520, 550);

    // 원자핵 펄스 에너지
    const pulse = Math.sin(elapsed * 4) * 5;
    const nGrad = ctx.createRadialGradient(
      nucleusPos.x, nucleusPos.y, 4,
      nucleusPos.x, nucleusPos.y, 35 + pulse
    );
    nGrad.addColorStop(0, "#ffffff");
    nGrad.addColorStop(0.4, "#ffd700");
    nGrad.addColorStop(1, "rgba(255, 100, 0, 0)");
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.arc(nucleusPos.x, nucleusPos.y, 35 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // 3개의 기울어진 3D 전자 궤도 링
    const rings = [
      { rx: 0.9, ry: 0.2, rz: 0.4, speed: 2.2, color: "#00f0ff", size: 190 },
      { rx: -0.8, ry: 0.6, rz: -0.3, speed: -1.9, color: "#ff007f", size: 210 },
      { rx: 0.3, ry: 1.0, rz: 0.8, speed: 2.5, color: "#ffd700", size: 175 },
    ];

    rings.forEach((ring, idx) => {
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();

      let electronPos: { x: number; y: number; scale: number } | null = null;
      const electronAngle = elapsed * ring.speed * 2;

      for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.08) {
        let v: Vec3 = {
          x: Math.cos(theta) * ring.size,
          y: Math.sin(theta) * ring.size,
          z: 0,
        };
        v = rotateX(v, ring.rx);
        v = rotateY(v, ring.ry + elapsed * 0.4);
        v = rotateZ(v, ring.rz);
        v.y += centerY - HEIGHT / 2;

        const p = project3D(v, WIDTH, HEIGHT, 520, 550);
        if (theta === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);

        if (Math.abs(theta - ((electronAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) < 0.1) {
          electronPos = p;
        }
      }
      ctx.stroke();

      // 궤도를 고속 회전하는 3D 전자
      if (electronPos) {
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 15;
        ctx.shadowColor = ring.color;
        ctx.beginPath();
        ctx.arc(electronPos.x, electronPos.y, 7 * electronPos.scale, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  ctx.restore();

  // 5. 상단 헤더 & 카테고리 3D 배지
  ctx.save();
  // 카테고리 태그 캡슐
  const badgeWidth = 240;
  const badgeHeight = 44;
  const badgeX = (WIDTH - badgeWidth) / 2;
  const badgeY = 90;

  ctx.fillStyle = "rgba(10, 16, 30, 0.85)";
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1.8;
  ctx.shadowBlur = 12;
  ctx.shadowColor = primaryColor;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = primaryColor;
  ctx.font = "800 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(isEng ? "⚡ 3D ENGINEERING MECHANISM" : "🔬 3D SCIENCE & EDUCATION", WIDTH / 2, badgeY + 28);

  // 상단 영상 제목 (임팩트 헤드라인)
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 38px sans-serif";
  ctx.textAlign = "center";
  ctx.shadowBlur = 14;
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  const titleLines = wrapText(ctx, title, WIDTH - 120).slice(0, 2);
  titleLines.forEach((line, idx) => {
    ctx.fillText(line, WIDTH / 2, 185 + idx * 48);
  });
  ctx.restore();

  // 6. 하단 바이럴 쇼츠 임팩트 자막 (2~4단어 리드미컬 하이라이트)
  const segmentIndex = Math.min(
    segments.length - 1,
    Math.floor(progress * segments.length)
  );
  const caption = segments[segmentIndex] ?? "";

  ctx.save();
  const captionY = HEIGHT * 0.76;
  ctx.font = "800 36px sans-serif";
  const captionLines = wrapText(ctx, caption, WIDTH - 120).slice(0, 3);
  const boxHeight = Math.max(110, captionLines.length * 52 + 40);

  // 어두운 반투명 네온 박스 백드롭
  ctx.fillStyle = "rgba(2, 6, 23, 0.92)";
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 22;
  ctx.shadowColor = primaryColor;
  ctx.beginPath();
  ctx.roundRect(40, captionY, WIDTH - 80, boxHeight, 24);
  ctx.fill();
  ctx.stroke();

  // 자막 텍스트 렌더링 (첫 단어 노란색/시안색 강조)
  captionLines.forEach((line, idx) => {
    ctx.textAlign = "center";
    ctx.fillStyle = idx === 0 ? "#ffeb3b" : "#ffffff";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.fillText(line, WIDTH / 2, captionY + 54 + idx * 52);
  });
  ctx.restore();

  // 7. 하단 오디오 스펙트럼 비주얼라이저 파형
  ctx.save();
  const waveY = HEIGHT - 70;
  const barCount = 36;
  const barWidth = 10;
  const gap = 8;
  const totalWaveWidth = barCount * (barWidth + gap);
  const startX = (WIDTH - totalWaveWidth) / 2;

  for (let i = 0; i < barCount; i++) {
    const waveH = Math.abs(Math.sin(elapsed * 8 + i * 0.4) * 28) + 8;
    ctx.fillStyle = i % 2 === 0 ? primaryColor : secondaryColor;
    ctx.shadowBlur = 6;
    ctx.shadowColor = primaryColor;
    ctx.beginPath();
    ctx.roundRect(startX + i * (barWidth + gap), waveY - waveH / 2, barWidth, waveH, 5);
    ctx.fill();
  }
  ctx.restore();

  // 8. 최하단 프로그레스 바
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fillRect(0, HEIGHT - 10, WIDTH, 10);
  const pGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
  pGrad.addColorStop(0, primaryColor);
  pGrad.addColorStop(1, secondaryColor);
  ctx.fillStyle = pGrad;
  ctx.fillRect(0, HEIGHT - 10, WIDTH * progress, 10);
}

/**
 * Web Audio API를 활용한 사이언스/테크 배경 앰비언트 신디사이저 오디오 생성
 */
function createSynthesizedAudioStream(audioCtx: AudioContext, durationSec: number): MediaStream {
  const dest = audioCtx.createMediaStreamDestination();

  // 1. 깊은 서브 베이스 앰비언스 (110Hz -> 55Hz)
  const oscBase = audioCtx.createOscillator();
  const baseGain = audioCtx.createGain();
  oscBase.type = "sine";
  oscBase.frequency.setValueAtTime(110, audioCtx.currentTime);
  oscBase.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + durationSec);
  baseGain.gain.setValueAtTime(0.22, audioCtx.currentTime);

  oscBase.connect(baseGain);
  baseGain.connect(dest);
  oscBase.start();

  // 2. 미래지향적 아르페지오 멜로디 비트
  const notes = [220, 277.18, 329.63, 440, 554.37, 659.25];
  const stepTime = 0.25;
  const totalSteps = Math.ceil(durationSec / stepTime);

  for (let s = 0; s < totalSteps; s++) {
    const noteTime = audioCtx.currentTime + s * stepTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = s % 2 === 0 ? "triangle" : "sine";
    const freq = notes[s % notes.length];
    osc.frequency.setValueAtTime(freq, noteTime);

    gain.gain.setValueAtTime(0, noteTime);
    gain.gain.linearRampToValueAtTime(0.08, noteTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + stepTime - 0.02);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(noteTime);
    osc.stop(noteTime + stepTime);
  }

  return dest.stream;
}

/**
 * 3D 비디오 + 신디사이저 오디오 통합 렌더링 함수
 */
export async function renderBrowserVideo({
  title,
  script,
  category,
  durationSec,
  onProgress,
}: BrowserVideoOptions): Promise<Blob> {
  if (typeof document === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("이 브라우저는 영상 녹화를 지원하지 않습니다. Chrome 또는 Edge 브라우저를 사용해주세요.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx || typeof canvas.captureStream !== "function") {
    throw new Error("3D 그래픽 캔버스를 초기화할 수 없습니다.");
  }

  const mimeType = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";

  // 대본 문장 분할
  const rawSegments = script
    .replace(/([.!?。！？\n])\s*/g, "$1|")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const segments = rawSegments.length > 0 ? rawSegments : [title];
  const duration = Math.max(3, Math.min(60, Math.floor(durationSec)));

  // 비디오 스트림 & 오디오 스트림 결합
  const videoStream = canvas.captureStream(FPS);

  let combinedStream = videoStream;
  let audioCtx: AudioContext | null = null;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      if (audioCtx.state === "suspended") {
        await audioCtx.resume();
      }
      const audioStream = createSynthesizedAudioStream(audioCtx, duration);
      const audioTracks = audioStream.getAudioTracks();
      if (audioTracks.length > 0) {
        combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioTracks,
        ]);
      }
    }
  } catch (audioErr) {
    console.warn("[Audio Synth Warning] Proceeding with video only:", audioErr);
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 4_500_000, // 고화질 4.5 Mbps
  });

  const chunks: BlobPart[] = [];
  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("3D 영상 녹화 중 인코더 오류가 발생했습니다."));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  const particles = initParticles(110);
  const startedAt = performance.now();

  try {
    recorder.start(400);

    await new Promise<void>((resolve, reject) => {
      const renderFrame = () => {
        if (recorder.state !== "recording") {
          reject(new Error("영상 인코딩이 중단되었습니다."));
          return;
        }

        const elapsed = (performance.now() - startedAt) / 1000;
        draw3DScene(ctx, title, segments, category, elapsed, duration, particles);
        onProgress?.(Math.min(1, elapsed / duration));

        if (elapsed >= duration) {
          recorder.stop();
          resolve();
        } else {
          requestAnimationFrame(renderFrame);
        }
      };
      requestAnimationFrame(renderFrame);
    });

    const blob = await recordingPromise;
    if (blob.size === 0) {
      throw new Error("생성된 영상 데이터가 비어 있습니다.");
    }
    return blob;
  } finally {
    if (recorder.state === "recording") recorder.stop();
    combinedStream.getTracks().forEach((t) => t.stop());
    if (audioCtx) {
      try {
        await audioCtx.close();
      } catch { }
    }
  }
}
