// Canvas-2D 3D scene presets (chip / network / robot / space / code) with an orbit camera.
// Colors here are drawn into the rendered video frames, not the app UI.

import type { ScenePreset } from "./scene-classifier";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitCamera {
  /** Distance from the target. */
  dist: number;
  /** Azimuth around the vertical axis (radians). */
  yaw: number;
  /** Elevation (radians, positive looks down on the scene). */
  pitch: number;
  /** Focal length in pixels. */
  focal: number;
  /** Screen position of the target. */
  cx: number;
  cy: number;
}

export interface Projected {
  x: number;
  y: number;
  z: number;
  s: number;
  visible: boolean;
}

export interface ScenePalette {
  primary: string;
  secondary: string;
  glow: string;
  bgInner: string;
  bgOuter: string;
}

export const PALETTES: Record<ScenePreset, ScenePalette> = {
  chip: {
    primary: "#22e6ff",
    secondary: "#34f5a4",
    glow: "#22e6ff",
    bgInner: "#062033",
    bgOuter: "#02060c",
  },
  network: {
    primary: "#4cc9ff",
    secondary: "#6b7cff",
    glow: "#4cc9ff",
    bgInner: "#0a1636",
    bgOuter: "#02040c",
  },
  robot: {
    primary: "#ffb23e",
    secondary: "#22d3ee",
    glow: "#ffb23e",
    bgInner: "#1c1407",
    bgOuter: "#040302",
  },
  space: {
    primary: "#8fb4ff",
    secondary: "#ffd166",
    glow: "#8fb4ff",
    bgInner: "#0d0b2a",
    bgOuter: "#010108",
  },
  code: {
    primary: "#3dfc9a",
    secondary: "#38bdf8",
    glow: "#3dfc9a",
    bgInner: "#04201a",
    bgOuter: "#010806",
  },
};

const CAMERA_CUTS = [
  { distance: 1, yaw: 0, pitch: 0, vertical: 0 },
  { distance: 0.9, yaw: 1.15, pitch: 0.12, vertical: 0.025 },
  { distance: 1.12, yaw: 2.35, pitch: -0.1, vertical: -0.02 },
  { distance: 0.84, yaw: 3.45, pitch: 0.2, vertical: 0.035 },
] as const;

/** Base camera motion per preset with content-specific angle, distance, and framing. */
export function cameraFor(
  preset: ScenePreset,
  localT: number,
  width: number,
  height: number,
  variation = 0,
): OrbitCamera {
  const base = { focal: 780, cx: width / 2, cy: height * 0.44 };
  let camera: OrbitCamera;
  switch (preset) {
    case "chip":
      camera = {
        ...base,
        dist: 760 - localT * 14,
        yaw: 0.6 + localT * 0.22,
        pitch: 0.72 + Math.sin(localT * 0.4) * 0.06,
      };
      break;
    case "network":
      camera = {
        ...base,
        dist: 720 - localT * 10,
        yaw: localT * 0.3,
        pitch: 0.25 + Math.sin(localT * 0.5) * 0.12,
      };
      break;
    case "robot":
      camera = {
        ...base,
        dist: 660 - localT * 10,
        yaw: -0.5 + localT * 0.25,
        pitch: 0.32,
        cy: height * 0.4,
      };
      break;
    case "space":
      camera = {
        ...base,
        dist: 900 - localT * 16,
        yaw: localT * 0.12,
        pitch: 0.38 + Math.sin(localT * 0.3) * 0.08,
      };
      break;
    case "code":
      camera = {
        ...base,
        dist: 700 - localT * 8,
        yaw: Math.sin(localT * 0.35) * 0.45,
        pitch: 0.12 + Math.sin(localT * 0.25) * 0.06,
      };
      break;
  }
  const cutIndex =
    ((Math.trunc(variation) % CAMERA_CUTS.length) + CAMERA_CUTS.length) % CAMERA_CUTS.length;
  const cut = CAMERA_CUTS[cutIndex];
  return {
    ...camera,
    dist: camera.dist * cut.distance,
    yaw: camera.yaw + cut.yaw,
    pitch: Math.min(1.2, Math.max(-0.1, camera.pitch + cut.pitch)),
    cy: camera.cy + height * cut.vertical,
  };
}

export function project(v: Vec3, cam: OrbitCamera): Projected {
  // rotate world by -yaw around Y, then by -pitch around X; camera sits on -Z looking +Z.
  const cy = Math.cos(-cam.yaw);
  const sy = Math.sin(-cam.yaw);
  const x1 = v.x * cy + v.z * sy;
  const z1 = -v.x * sy + v.z * cy;
  const cp = Math.cos(-cam.pitch);
  const sp = Math.sin(-cam.pitch);
  const y2 = v.y * cp - z1 * sp;
  const z2 = v.y * sp + z1 * cp;
  const z = z2 + cam.dist;
  const visible = z > 40;
  const s = cam.focal / Math.max(40, z);
  return { x: cam.cx + x1 * s, y: cam.cy - y2 * s, z, s, visible };
}

// Deterministic random so every render of the same script looks identical.
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function line(ctx: CanvasRenderingContext2D, a: Projected, b: Projected) {
  if (!a.visible || !b.visible) return;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, p: Projected, r: number) {
  if (!p.visible) return;
  ctx.beginPath();
  ctx.arc(p.x, p.y, Math.max(0.5, r * p.s), 0, Math.PI * 2);
  ctx.fill();
}

function polyline(ctx: CanvasRenderingContext2D, pts: Projected[], close = false) {
  ctx.beginPath();
  let started = false;
  for (const p of pts) {
    if (!p.visible) {
      started = false;
      continue;
    }
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else ctx.lineTo(p.x, p.y);
  }
  if (close && started) ctx.closePath();
  ctx.stroke();
}

function quad(ctx: CanvasRenderingContext2D, pts: Projected[]) {
  if (pts.some((p) => !p.visible)) return false;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  return true;
}

function box(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  c: Vec3,
  sx: number,
  sy: number,
  sz: number,
) {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const v = [
    [-hx, -hy, -hz],
    [hx, -hy, -hz],
    [hx, hy, -hz],
    [-hx, hy, -hz],
    [-hx, -hy, hz],
    [hx, -hy, hz],
    [hx, hy, hz],
    [-hx, hy, hz],
  ].map(([x, y, z]) => project({ x: c.x + x, y: c.y + y, z: c.z + z }, cam));
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  for (const [a, b] of edges) line(ctx, v[a], v[b]);
}

// ---------------------------------------------------------------------------
// Shared backdrop
// ---------------------------------------------------------------------------

const STARS = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 140 }, () => ({
    x: (rnd() - 0.5) * 3000,
    y: (rnd() - 0.5) * 3000,
    z: (rnd() - 0.5) * 3000,
    r: rnd() * 1.6 + 0.4,
  }));
})();

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: ScenePalette,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const bg = ctx.createRadialGradient(w / 2, h * 0.45, 40, w / 2, h * 0.45, h * 0.75);
  bg.addColorStop(0, palette.bgInner);
  bg.addColorStop(1, palette.bgOuter);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawStars(ctx: CanvasRenderingContext2D, cam: OrbitCamera, alpha: number) {
  ctx.fillStyle = "#ffffff";
  for (const s of STARS) {
    const p = project(s, { ...cam, dist: cam.dist + 1600 });
    if (!p.visible) continue;
    ctx.globalAlpha = alpha * Math.min(0.9, 0.25 + p.s * 0.9);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloorGrid(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  y: number,
  color: string,
  alpha: number,
  t: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  const size = 900;
  const step = 90;
  const offset = (t * 40) % step;
  for (let i = -size; i <= size; i += step) {
    ctx.globalAlpha = alpha * 0.18;
    line(ctx, project({ x: i, y, z: -size }, cam), project({ x: i, y, z: size }, cam));
    line(
      ctx,
      project({ x: -size, y, z: i + offset }, cam),
      project({ x: size, y, z: i + offset }, cam),
    );
  }
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

function drawChip(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  t: number,
  pal: ScenePalette,
  alpha: number,
) {
  drawFloorGrid(ctx, cam, -40, pal.primary, alpha, t * 0.3);
  // circuit traces radiating from the package, with travelling pulses
  const traces = 10;
  ctx.lineWidth = 1.6;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < traces; i++) {
      const u = -100 + (i * 200) / (traces - 1);
      const len = 260 + ((i * 37) % 5) * 40;
      const dir = side % 2 === 0 ? 1 : -1;
      const along = side < 2;
      const a: Vec3 = along ? { x: u, y: -38, z: dir * 115 } : { x: dir * 115, y: -38, z: u };
      const bend: Vec3 = along
        ? { x: u, y: -38, z: dir * (115 + len * 0.5) }
        : { x: dir * (115 + len * 0.5), y: -38, z: u };
      const end: Vec3 = along
        ? { x: u + dir * 60, y: -38, z: dir * (115 + len) }
        : { x: dir * (115 + len), y: -38, z: u + dir * 60 };
      ctx.strokeStyle = pal.primary;
      ctx.globalAlpha = alpha * 0.55;
      polyline(ctx, [project(a, cam), project(bend, cam), project(end, cam)]);
      // pulse
      const k = (t * 0.55 + i * 0.13 + side * 0.25) % 1;
      const p =
        k < 0.5
          ? { x: a.x + (bend.x - a.x) * k * 2, y: -38, z: a.z + (bend.z - a.z) * k * 2 }
          : {
              x: bend.x + (end.x - bend.x) * (k - 0.5) * 2,
              y: -38,
              z: bend.z + (end.z - bend.z) * (k - 0.5) * 2,
            };
      ctx.fillStyle = pal.secondary;
      ctx.globalAlpha = alpha;
      dot(ctx, project(p, cam), 5);
    }
  }
  // package body
  ctx.shadowBlur = 18;
  ctx.shadowColor = pal.glow;
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = pal.primary;
  ctx.globalAlpha = alpha;
  const top = [
    { x: -110, y: 0, z: -110 },
    { x: 110, y: 0, z: -110 },
    { x: 110, y: 0, z: 110 },
    { x: -110, y: 0, z: 110 },
  ].map((v) => project(v, cam));
  if (quad(ctx, top)) {
    ctx.fillStyle = "rgba(10, 30, 45, 0.85)";
    ctx.fill();
    ctx.stroke();
  }
  box(ctx, cam, { x: 0, y: -20, z: 0 }, 220, 40, 220);
  // die grid with activity
  ctx.lineWidth = 1.4;
  for (let gx = 0; gx < 5; gx++) {
    for (let gz = 0; gz < 5; gz++) {
      const x = -80 + gx * 40;
      const z = -80 + gz * 40;
      const on = Math.sin(t * 3 + gx * 1.7 + gz * 2.3) > 0.35;
      const cell = [
        { x: x - 15, y: 1, z: z - 15 },
        { x: x + 15, y: 1, z: z - 15 },
        { x: x + 15, y: 1, z: z + 15 },
        { x: x - 15, y: 1, z: z + 15 },
      ].map((v) => project(v, cam));
      if (quad(ctx, cell)) {
        ctx.globalAlpha = alpha * (on ? 0.9 : 0.25);
        ctx.fillStyle = on ? pal.secondary : pal.primary;
        ctx.fill();
      }
    }
  }
  ctx.shadowBlur = 0;
}

const NETWORK = (() => {
  const n = 30;
  const nodes: Vec3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    nodes.push({ x: Math.cos(th) * r * 230, y: y * 230, z: Math.sin(th) * r * 230 });
  }
  const edges: Array<[number, number]> = [];
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => ({ j, d: (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 3);
    for (const o of near) if (i < o.j) edges.push([i, o.j]);
  });
  return { nodes, edges };
})();

function drawNetwork(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  t: number,
  pal: ScenePalette,
  alpha: number,
) {
  drawStars(ctx, cam, alpha * 0.6);
  const spin = t * 0.25;
  const rot = (v: Vec3): Vec3 => ({
    x: v.x * Math.cos(spin) + v.z * Math.sin(spin),
    y: v.y,
    z: -v.x * Math.sin(spin) + v.z * Math.cos(spin),
  });
  const pts = NETWORK.nodes.map((v) => project(rot(v), cam));
  ctx.lineWidth = 1.4;
  NETWORK.edges.forEach(([a, b], i) => {
    const depth = Math.min(1, Math.max(0.2, (pts[a].s + pts[b].s) * 0.9));
    ctx.strokeStyle = i % 3 === 0 ? pal.secondary : pal.primary;
    ctx.globalAlpha = alpha * 0.5 * depth;
    line(ctx, pts[a], pts[b]);
    // data packet
    const k = (t * 0.6 + i * 0.173) % 1;
    const va = rot(NETWORK.nodes[a]);
    const vb = rot(NETWORK.nodes[b]);
    const pk = project(
      { x: va.x + (vb.x - va.x) * k, y: va.y + (vb.y - va.y) * k, z: va.z + (vb.z - va.z) * k },
      cam,
    );
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = alpha * depth;
    dot(ctx, pk, 3.2);
  });
  ctx.shadowBlur = 14;
  ctx.shadowColor = pal.glow;
  pts.forEach((p, i) => {
    const pulse = 1 + Math.max(0, Math.sin(t * 2.5 + i)) * 0.6;
    ctx.fillStyle = i % 4 === 0 ? pal.secondary : pal.primary;
    ctx.globalAlpha = alpha * Math.min(1, 0.35 + p.s);
    dot(ctx, p, 7 * pulse);
  });
  ctx.shadowBlur = 0;
  // equator ring
  ctx.strokeStyle = pal.primary;
  ctx.globalAlpha = alpha * 0.25;
  const ring: Projected[] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12)
    ring.push(project({ x: Math.cos(a) * 300, y: 0, z: Math.sin(a) * 300 }, cam));
  polyline(ctx, ring);
}

function drawRobot(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  t: number,
  pal: ScenePalette,
  alpha: number,
) {
  const floorY = -220;
  drawFloorGrid(ctx, cam, floorY, pal.secondary, alpha, t * 0.2);
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = pal.primary;
  ctx.shadowBlur = 16;
  ctx.shadowColor = pal.glow;
  // base ring
  const baseRing: Projected[] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.2)
    baseRing.push(project({ x: Math.cos(a) * 90, y: floorY, z: Math.sin(a) * 90 }, cam));
  polyline(ctx, baseRing);
  const turret = t * 0.6;
  const shoulder = 0.9 + Math.sin(t * 1.1) * 0.35;
  const elbow = -1.2 + Math.sin(t * 1.4 + 1) * 0.45;
  const wrist = Math.sin(t * 2) * 0.5;
  const dir = (pitch: number): Vec3 => ({
    x: Math.cos(pitch) * Math.cos(turret),
    y: Math.sin(pitch),
    z: Math.cos(pitch) * Math.sin(turret),
  });
  const j0: Vec3 = { x: 0, y: floorY + 60, z: 0 };
  const d1 = dir(shoulder);
  const j1: Vec3 = { x: j0.x + d1.x * 220, y: j0.y + d1.y * 220, z: j0.z + d1.z * 220 };
  const d2 = dir(shoulder + elbow);
  const j2: Vec3 = { x: j1.x + d2.x * 190, y: j1.y + d2.y * 190, z: j1.z + d2.z * 190 };
  const d3 = dir(shoulder + elbow + wrist);
  const j3: Vec3 = { x: j2.x + d3.x * 70, y: j2.y + d3.y * 70, z: j2.z + d3.z * 70 };
  box(ctx, cam, { x: 0, y: floorY + 30, z: 0 }, 120, 60, 120);
  // segments drawn as twin rails
  const rails = (a: Vec3, b: Vec3, w: number) => {
    const nx = -Math.sin(turret) * w;
    const nz = Math.cos(turret) * w;
    line(
      ctx,
      project({ x: a.x + nx, y: a.y, z: a.z + nz }, cam),
      project({ x: b.x + nx, y: b.y, z: b.z + nz }, cam),
    );
    line(
      ctx,
      project({ x: a.x - nx, y: a.y, z: a.z - nz }, cam),
      project({ x: b.x - nx, y: b.y, z: b.z - nz }, cam),
    );
  };
  rails(j0, j1, 26);
  ctx.strokeStyle = pal.secondary;
  rails(j1, j2, 20);
  ctx.strokeStyle = pal.primary;
  rails(j2, j3, 12);
  // gripper
  const open = 18 + Math.sin(t * 3) * 10;
  const g = (s: number): Vec3 => ({
    x: j3.x - Math.sin(turret) * open * s,
    y: j3.y,
    z: j3.z + Math.cos(turret) * open * s,
  });
  const tip = (s: number): Vec3 => ({
    x: g(s).x + d3.x * 40,
    y: g(s).y + d3.y * 40,
    z: g(s).z + d3.z * 40,
  });
  line(ctx, project(g(1), cam), project(tip(1), cam));
  line(ctx, project(g(-1), cam), project(tip(-1), cam));
  // joints
  ctx.fillStyle = "#ffffff";
  for (const j of [j0, j1, j2, j3]) dot(ctx, project(j, cam), 11);
  ctx.shadowBlur = 0;
  // spinning gear beside the arm
  ctx.strokeStyle = pal.secondary;
  ctx.globalAlpha = alpha * 0.7;
  const gear: Projected[] = [];
  const teeth = 14;
  for (let k = 0; k <= teeth * 2; k++) {
    const a = (k / (teeth * 2)) * Math.PI * 2 + t * 0.8;
    const r = k % 2 === 0 ? 66 : 52;
    gear.push(
      project({ x: -210 + Math.cos(a) * r, y: floorY + 100 + Math.sin(a) * r, z: -60 }, cam),
    );
  }
  polyline(ctx, gear, true);
}

function drawSpace(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  t: number,
  pal: ScenePalette,
  alpha: number,
) {
  drawStars(ctx, cam, alpha);
  const R = 150;
  const spin = t * 0.35;
  ctx.globalAlpha = alpha;
  // planet glow
  const c = project({ x: 0, y: 0, z: 0 }, cam);
  if (c.visible) {
    const g = ctx.createRadialGradient(c.x, c.y, R * c.s * 0.2, c.x, c.y, R * c.s * 1.25);
    g.addColorStop(0, "rgba(120, 150, 255, 0.45)");
    g.addColorStop(1, "rgba(120, 150, 255, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, R * c.s * 1.25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = pal.primary;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = Math.sin((lat * Math.PI) / 180) * R;
    const r = Math.cos((lat * Math.PI) / 180) * R;
    const pts: Projected[] = [];
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.15)
      pts.push(project({ x: Math.cos(a) * r, y, z: Math.sin(a) * r }, cam));
    ctx.globalAlpha = alpha * 0.55;
    polyline(ctx, pts);
  }
  for (let m = 0; m < 6; m++) {
    const lon = spin + (m * Math.PI) / 6;
    const pts: Projected[] = [];
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.15) {
      pts.push(
        project(
          {
            x: Math.cos(a) * R * Math.cos(lon),
            y: Math.sin(a) * R,
            z: Math.cos(a) * R * Math.sin(lon),
          },
          cam,
        ),
      );
    }
    ctx.globalAlpha = alpha * 0.4;
    polyline(ctx, pts);
  }
  // tilted ring
  ctx.lineWidth = 3;
  ctx.strokeStyle = pal.secondary;
  ctx.shadowBlur = 16;
  ctx.shadowColor = pal.secondary;
  ctx.globalAlpha = alpha * 0.8;
  const tilt = 0.35;
  const ring: Projected[] = [];
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.06) {
    const x = Math.cos(a) * 270;
    const z = Math.sin(a) * 270;
    ring.push(project({ x, y: z * Math.sin(tilt), z: z * Math.cos(tilt) }, cam));
  }
  polyline(ctx, ring);
  // orbiting moon
  const ma = t * 0.9;
  const moon = project({ x: Math.cos(ma) * 380, y: Math.sin(ma) * 90, z: Math.sin(ma) * 380 }, cam);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#ffffff";
  ctx.globalAlpha = alpha;
  dot(ctx, moon, 16);
  ctx.shadowBlur = 0;
}

const CODE_LINES = (() => {
  const rnd = seeded(42);
  return Array.from({ length: 40 }, () => ({
    indent: Math.floor(rnd() * 4),
    tokens: Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => ({
      w: 20 + rnd() * 70,
      kind: Math.floor(rnd() * 3),
    })),
  }));
})();

function drawCode(
  ctx: CanvasRenderingContext2D,
  cam: OrbitCamera,
  t: number,
  pal: ScenePalette,
  alpha: number,
) {
  drawStars(ctx, cam, alpha * 0.4);
  const panels = [
    { x: -40, z: 0, w: 360, h: 470, scroll: 18 },
    { x: 230, z: 220, w: 260, h: 360, scroll: 26 },
    { x: -300, z: 260, w: 240, h: 320, scroll: 12 },
  ];
  const colors = [pal.primary, pal.secondary, "#f8fafc"];
  panels.forEach((pn, idx) => {
    const corners = [
      { x: pn.x - pn.w / 2, y: pn.h / 2, z: pn.z },
      { x: pn.x + pn.w / 2, y: pn.h / 2, z: pn.z },
      { x: pn.x + pn.w / 2, y: -pn.h / 2, z: pn.z },
      { x: pn.x - pn.w / 2, y: -pn.h / 2, z: pn.z },
    ].map((v) => project(v, cam));
    ctx.globalAlpha = alpha * (idx === 0 ? 0.92 : 0.6);
    if (quad(ctx, corners)) {
      ctx.fillStyle = "rgba(4, 18, 16, 0.88)";
      ctx.fill();
      ctx.strokeStyle = pal.primary;
      ctx.lineWidth = idx === 0 ? 2.2 : 1.4;
      ctx.shadowBlur = idx === 0 ? 18 : 0;
      ctx.shadowColor = pal.glow;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    const lineH = 22;
    const offset = (((t * pn.scroll) % lineH) + lineH) % lineH;
    const rows = Math.floor((pn.h - 40) / lineH);
    const first = Math.floor((t * pn.scroll) / lineH);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (let r = 0; r < rows; r++) {
      const n = CODE_LINES.length;
      const ln = CODE_LINES[(((first + r + idx * 7) % n) + n) % n];
      const y = pn.h / 2 - 28 - r * lineH + offset;
      if (y < -pn.h / 2 + 16 || y > pn.h / 2 - 16) continue;
      let x = pn.x - pn.w / 2 + 24 + ln.indent * 18;
      for (const tok of ln.tokens) {
        const w = Math.min(tok.w, pn.x + pn.w / 2 - 20 - x);
        if (w <= 4) break;
        ctx.strokeStyle = colors[tok.kind];
        ctx.globalAlpha = alpha * (idx === 0 ? 0.9 : 0.5);
        line(ctx, project({ x, y, z: pn.z - 1 }, cam), project({ x: x + w, y, z: pn.z - 1 }, cam));
        x += w + 12;
      }
    }
    ctx.lineCap = "butt";
  });
  // blinking cursor on the main panel
  if (Math.floor(t * 2) % 2 === 0) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pal.primary;
    const p = project({ x: -150, y: -150, z: -2 }, cam);
    if (p.visible) ctx.fillRect(p.x, p.y - 12 * p.s, 10 * p.s, 22 * p.s);
  }
}

export function drawScene(
  ctx: CanvasRenderingContext2D,
  preset: ScenePreset,
  cam: OrbitCamera,
  localT: number,
  alpha: number,
) {
  if (alpha <= 0.001) return;
  const pal = PALETTES[preset];
  ctx.save();
  switch (preset) {
    case "chip":
      drawChip(ctx, cam, localT, pal, alpha);
      break;
    case "network":
      drawNetwork(ctx, cam, localT, pal, alpha);
      break;
    case "robot":
      drawRobot(ctx, cam, localT, pal, alpha);
      break;
    case "space":
      drawSpace(ctx, cam, localT, pal, alpha);
      break;
    case "code":
      drawCode(ctx, cam, localT, pal, alpha);
      break;
  }
  ctx.restore();
}

export function smoothstep(x: number) {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * Transition state between two scene blocks centred on `boundary`.
 * Outgoing scene: camera dollies in and fades out. Incoming: starts pulled back,
 * settles in and fades in.
 */
export function transitionAt(t: number, boundary: number, duration: number) {
  const p = smoothstep((t - (boundary - duration / 2)) / duration);
  return {
    progress: p,
    outAlpha: 1 - p,
    inAlpha: p,
    outDolly: 1 - 0.35 * p,
    inDolly: 1 + 0.55 * (1 - p),
    outYaw: 0.35 * p,
    inYaw: -0.35 * (1 - p),
  };
}
