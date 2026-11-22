import { sceneVariantFor, type ScenePreset, type SceneVariant } from "./scene-classifier";

const SUBJECT_PRESETS: Record<string, ScenePreset> = {
  "sat-college": "code",
  math: "code",
  physics: "space",
  chemistry: "space",
  "economics-society": "network",
  "college-deep": "code",
  "cs-ai": "code",
};

const SUBJECT_LABELS: Record<string, string> = {
  "sat-college": "수능 · 입시",
  math: "수학 시각화",
  physics: "물리 현상",
  chemistry: "분자 · 생명과학",
  "economics-society": "경제 · 사회 데이터",
  "college-deep": "전공 심화",
  "cs-ai": "컴퓨터과학 · AI",
};

const ACCENTS: Record<SceneVariant, string> = {
  terminal: "#4bd4a5",
  neural: "#9a83ff",
  server: "#57c9e8",
  topology: "#f2bc45",
  processor: "#49d6c7",
  wafer: "#b68cff",
  engine: "#f2bc45",
  arm: "#58c7e6",
  gearbox: "#e86f61",
  planet: "#59b9ff",
  solar: "#f4bb46",
  chalkboard: "#8be0b6",
  exam: "#f0ba4c",
  graph: "#47c6e7",
  vector: "#a28aff",
  wave: "#46cee5",
  field: "#f0ba4c",
  molecule: "#e66d66",
  cell: "#b38cff",
  economy: "#4fd2ad",
  timeline: "#f0ba4c",
  research: "#57c9e8",
  attention: "#9a83ff",
  gpu: "#4fd2ad",
  memory: "#f0ba4c",
  "hash-table": "#46c6e7",
};

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 4,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  fill = true,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawGraph(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  const left = 170;
  const right = 550;
  const top = 400;
  const bottom = 725;
  for (let i = 0; i <= 4; i++) {
    const y = top + ((bottom - top) / 4) * i;
    drawLine(ctx, left, y, right, y, "rgba(165,190,205,.22)", 2);
  }
  drawLine(ctx, left, top, left, bottom, "#e2ebf1", 4);
  drawLine(ctx, left, bottom, right, bottom, "#e2ebf1", 4);
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const x = left + ((right - left) / 90) * i;
    const y = 560 - Math.sin(i / 9 + time * 0.55) * 105 - Math.cos(i / 15) * 32;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.stroke();
  const markerX = left + 35 + ((time * 54) % (right - left - 70));
  const index = ((markerX - left) / (right - left)) * 90;
  const markerY = 560 - Math.sin(index / 9 + time * 0.55) * 105 - Math.cos(index / 15) * 32;
  drawCircle(ctx, markerX, markerY, 12, "#fff3c4");
}

function drawExam(ctx: CanvasRenderingContext2D, time: number) {
  for (let i = 0; i < 5; i++) {
    const y = 405 + i * 62;
    ctx.strokeStyle = i === Math.floor(time * 0.8) % 5 ? "#f0ba4c" : "#8da0af";
    ctx.lineWidth = 3;
    ctx.strokeRect(150, y, 26, 26);
    drawLine(ctx, 198, y + 12, 540 - (i % 2) * 70, y + 12, "#d7e0e7", 5);
    if (i === Math.floor(time * 0.8) % 5) {
      drawLine(ctx, 151, y + 13, 160, y + 23, "#f0ba4c", 5);
      drawLine(ctx, 160, y + 23, 176, y + 2, "#f0ba4c", 5);
    }
  }
  drawLine(ctx, 150, 735, 540, 735, "rgba(141,160,175,.5)", 3);
}

function drawMolecule(ctx: CanvasRenderingContext2D, time: number) {
  const centerX = 360;
  const centerY = 570;
  const rotation = time * 0.18;
  const atoms = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 + rotation;
    return { x: centerX + Math.cos(angle) * 120, y: centerY + Math.sin(angle) * 120 };
  });
  atoms.forEach((atom, i) => {
    const next = atoms[(i + 1) % atoms.length]!;
    drawLine(ctx, atom.x, atom.y, next.x, next.y, "#d7e0e7", 7);
  });
  atoms.forEach((atom, i) => {
    drawCircle(ctx, atom.x, atom.y, 21, i === 1 ? "#e66d66" : "#8ba0b2");
    const angle = (i / 6) * Math.PI * 2 + rotation;
    const hx = centerX + Math.cos(angle) * 195;
    const hy = centerY + Math.sin(angle) * 195;
    drawLine(ctx, atom.x, atom.y, hx, hy, "#8da0af", 4);
    drawCircle(ctx, hx, hy, 12, "#eef3f7");
  });
  drawCircle(ctx, centerX, centerY, 58, "rgba(72,198,231,.1)", false);
}

function drawCell(ctx: CanvasRenderingContext2D, time: number) {
  drawCircle(ctx, 360, 565, 175, "rgba(87,201,232,.12)");
  drawCircle(ctx, 360, 565, 175, "#57c9e8", false);
  drawCircle(ctx, 335, 565, 62, "rgba(154,131,255,.62)");
  drawCircle(ctx, 335, 565, 62, "#c3b4ff", false);
  for (let i = 0; i < 4; i++) {
    const angle = time * 0.18 + (i / 4) * Math.PI * 2;
    const x = 360 + Math.cos(angle) * 115;
    const y = 565 + Math.sin(angle) * 90;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#e87b63";
    ctx.beginPath();
    ctx.ellipse(0, 0, 35, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    drawLine(ctx, -18, 0, 18, 0, "#ffc7a8", 3);
    ctx.restore();
  }
}

function drawEconomy(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  const values = [140, 210, 170, 255, 205, 300, 270];
  const points: Array<{ x: number; y: number }> = [];
  values.forEach((height, i) => {
    const x = 150 + i * 68;
    const y = 735 - height;
    ctx.fillStyle = i % 2 ? "#7187ef" : accent;
    ctx.fillRect(x, y, 42, height);
    points.push({ x: x + 21, y: y - 14 });
  });
  points.forEach((point, i) => {
    if (i < points.length - 1)
      drawLine(ctx, point.x, point.y, points[i + 1]!.x, points[i + 1]!.y, "#f1bc4b", 5);
    drawCircle(ctx, point.x, point.y, 9, "#fff1c0");
  });
  const active = points[Math.floor(time * 2) % points.length]!;
  drawCircle(ctx, active.x, active.y, 15, "#f1bc4b", false);
}

function drawAttention(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  const left = Array.from({ length: 4 }, (_, i) => ({ x: 180, y: 435 + i * 78 }));
  const right = Array.from({ length: 4 }, (_, i) => ({ x: 535, y: 435 + i * 78 }));
  left.forEach((source, row) =>
    right.forEach((target, column) => {
      const weight = ((row * 3 + column * 5) % 9) / 10 + 0.2;
      drawLine(
        ctx,
        source.x + 22,
        source.y,
        target.x - 22,
        target.y,
        `rgba(154,131,255,${weight})`,
        2 + weight * 4,
      );
    }),
  );
  left.forEach((point, i) => {
    ctx.fillStyle = ["#47c6e7", "#8c7cf4", "#f0ba4c", "#4fd2ad"][i]!;
    ctx.fillRect(point.x - 24, point.y - 22, 48, 44);
  });
  right.forEach((point, i) =>
    drawCircle(ctx, point.x, point.y, 21, ["#47c6e7", "#8c7cf4", "#f0ba4c", "#4fd2ad"][i]!),
  );
  const row = Math.floor(time * 1.1) % 4;
  const progress = (time * 0.8) % 1;
  drawCircle(
    ctx,
    left[row]!.x + (right[(row + 1) % 4]!.x - left[row]!.x) * progress,
    left[row]!.y + (right[(row + 1) % 4]!.y - left[row]!.y) * progress,
    9,
    "#ffffff",
  );
  drawLine(ctx, 265, 785, 455, 785, accent, 4);
}

function drawGpu(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  const colors = [accent, "#55bfe8", "#9a83ff", "#f0ba4c"];
  for (let row = 0; row < 4; row++) {
    for (let column = 0; column < 4; column++) {
      const x = 205 + column * 78;
      const y = 430 + row * 78;
      ctx.fillStyle = "#26394a";
      ctx.fillRect(x - 4, y - 4, 64, 64);
      ctx.fillStyle = colors[(row + column) % colors.length]!;
      ctx.globalAlpha = 0.62 + 0.32 * Math.sin(time * 2 + row + column);
      ctx.fillRect(x + 5, y + 5, 46, 46);
      ctx.globalAlpha = 1;
    }
  }
  ctx.strokeStyle = "#f0ba4c";
  ctx.lineWidth = 5;
  ctx.strokeRect(182, 405, 340, 340);
}

function drawMemory(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  for (let column = 0; column < 5; column++) {
    const x = 145 + column * 92;
    ctx.strokeStyle = "#8da0af";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, 420, 70, 300);
    for (let row = 0; row < 4; row++) {
      ctx.fillStyle = (row + column) % 2 ? "#55bfe8" : accent;
      ctx.globalAlpha = 0.65 + 0.25 * Math.sin(time * 2 + row + column);
      ctx.fillRect(x + 10, 435 + row * 68, 50, 48);
      ctx.globalAlpha = 1;
    }
  }
  const packetX = 145 + ((time * 110) % 460);
  drawCircle(ctx, packetX, 770, 12, "#f0ba4c");
  drawLine(ctx, 145, 770, 575, 770, "#f0ba4c", 3);
}

function drawHashTable(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  for (let row = 0; row < 5; row++) {
    const y = 420 + row * 68;
    ctx.fillStyle = "#31485b";
    ctx.fillRect(145, y - 23, 120, 46);
    ctx.fillStyle = accent;
    ctx.fillRect(160, y - 7, 20, 14);
    drawLine(ctx, 270, y, 335, y, "#b4c3ce", 4);
    const count = row === 2 ? 3 : row === 4 ? 2 : 1;
    for (let item = 0; item < count; item++) {
      const x = 365 + item * 72;
      drawCircle(ctx, x, y, 20, item === 0 ? accent : "#8e7af0");
      if (item < count - 1) drawLine(ctx, x + 21, y, x + 51, y, "#b4c3ce", 4);
    }
  }
  const active = Math.floor(time * 0.9) % 5;
  ctx.strokeStyle = "#f0ba4c";
  ctx.lineWidth = 4;
  ctx.strokeRect(137, 397 + active * 68, 136, 46);
}

function drawNeural(ctx: CanvasRenderingContext2D, time: number, accent: string) {
  const layers = [3, 5, 3];
  const nodes: Array<Array<{ x: number; y: number }>> = [];
  layers.forEach((count, layer) => {
    const column: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      const point = { x: 185 + layer * 175, y: 470 + i * 58 - (count - 1) * 29 };
      column.push(point);
    }
    nodes.push(column);
  });
  nodes
    .slice(0, -1)
    .forEach((layer, index) =>
      layer.forEach((source) =>
        nodes[index + 1]!.forEach((target) =>
          drawLine(ctx, source.x, source.y, target.x, target.y, "rgba(154,131,255,.45)", 3),
        ),
      ),
    );
  nodes
    .flat()
    .forEach((point, i) =>
      drawCircle(
        ctx,
        point.x,
        point.y,
        15,
        i % 3 === Math.floor(time * 3) % 3 ? accent : "#77889c",
      ),
    );
}

export function drawSubjectScene(
  ctx: CanvasRenderingContext2D,
  subcategory: string | undefined,
  text: string,
  time: number,
  shot: number,
) {
  if (!subcategory) return;
  const preset = SUBJECT_PRESETS[subcategory];
  if (!preset) return;
  const variant = sceneVariantFor(preset, text, shot, subcategory);
  const accent = ACCENTS[variant];
  const labels = SUBJECT_LABELS[subcategory];
  ctx.save();
  ctx.fillStyle = "rgba(7, 15, 27, 0.88)";
  ctx.strokeStyle = `${accent}cc`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(76, 228, 568, 590, 28);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = '700 24px "IBM Plex Sans KR", sans-serif';
  ctx.fillStyle = accent;
  ctx.fillText(labels, 112, 286);
  ctx.font = '800 19px "IBM Plex Sans KR", sans-serif';
  ctx.fillStyle = "#e5edf3";
  ctx.fillText(text.slice(0, 28), 112, 332, 496);

  if (variant === "graph" || variant === "vector" || variant === "chalkboard") {
    if (variant === "vector") {
      drawLine(ctx, 360, 700, 520, 500, "#47c6e7", 8);
      drawLine(ctx, 360, 700, 185, 565, "#e86f66", 8);
      drawLine(ctx, 360, 700, 375, 420, "#4fd2ad", 8);
      drawCircle(ctx, 360, 700, 12, "#fff0be");
      drawCircle(ctx, 520, 500, 12, "#47c6e7");
      drawCircle(ctx, 185, 565, 12, "#e86f66");
      drawCircle(ctx, 375, 420, 12, "#4fd2ad");
    } else drawGraph(ctx, time, accent);
  } else if (variant === "exam") drawExam(ctx, time);
  else if (variant === "wave") drawGraph(ctx, time, accent);
  else if (variant === "field") {
    for (let i = 0; i < 4; i++)
      drawCircle(ctx, 360, 570, 60 + i * 48, i % 2 ? "#46cee5" : "#f0ba4c", false);
    drawCircle(ctx, 360, 570, 42, "#55bfe8");
    drawCircle(ctx, 360 + Math.cos(time) * 180, 570 + Math.sin(time) * 85, 12, "#ffffff");
  } else if (variant === "molecule") drawMolecule(ctx, time);
  else if (variant === "cell") drawCell(ctx, time);
  else if (variant === "economy" || variant === "timeline" || variant === "research")
    drawEconomy(ctx, time, accent);
  else if (variant === "attention") drawAttention(ctx, time, accent);
  else if (variant === "gpu") drawGpu(ctx, time, accent);
  else if (variant === "memory") drawMemory(ctx, time, accent);
  else if (variant === "hash-table") drawHashTable(ctx, time, accent);
  else drawNeural(ctx, time, accent);
  ctx.restore();
  return variant;
}
