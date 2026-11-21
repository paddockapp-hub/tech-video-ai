import * as THREE from "three";

const FRAME_WIDTH = 720;
const FRAME_HEIGHT = 1280;
const FRAME_FONT = '"Inter", "Noto Sans KR", sans-serif';
const FOUNDATION_TERMS = /말뚝|파일기초|파일 기초|기초공사|기초 공사|천공|지반|아파트|공사장|건설|pile|foundation|construction|drill/i;

function seededRandom(seedText: string) {
  let seed = Array.from(seedText).reduce((value, character) => value + character.charCodeAt(0), 0) || 1;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function createSurfaceTexture(color: string, seed: string, detail: "soil" | "concrete" | "steel") {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("3D 재질 텍스처를 만들 수 없습니다.");

  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(`${seed}:${detail}`);
  const count = detail === "soil" ? 700 : detail === "concrete" ? 340 : 220;

  for (let index = 0; index < count; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const alpha = 0.035 + random() * 0.12;
    context.fillStyle = random() > 0.5
      ? `rgba(255, 245, 225, ${alpha})`
      : `rgba(16, 21, 25, ${alpha})`;
    if (detail === "soil") {
      context.beginPath();
      context.ellipse(x, y, 1 + random() * 4, 1 + random() * 2.5, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    } else {
      context.fillRect(x, y, detail === "steel" ? 32 : 2 + random() * 5, 1 + random() * 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(detail === "steel" ? 2 : 4, 3);
  texture.anisotropy = 4;
  return texture;
}

function createMaterial(
  color: string,
  roughness: number,
  texture?: THREE.Texture,
  metalness = 0,
) {
  return new THREE.MeshStandardMaterial({
    color,
    map: texture,
    roughness,
    metalness,
  });
}

function addBox(
  scene: THREE.Scene | THREE.Group,
  size: THREE.Vector3,
  position: THREE.Vector3,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function addBeam(
  scene: THREE.Scene | THREE.Group,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 8,
) {
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), radialSegments),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function createGearGeometry(teeth: number, rootRadius: number, tipRadius: number, depth: number) {
  const shape = new THREE.Shape();
  const toothSteps = teeth * 4;
  for (let step = 0; step < toothSteps; step += 1) {
    const angle = (step / toothSteps) * Math.PI * 2;
    const quadrant = step % 4;
    const radius = quadrant === 1 || quadrant === 2 ? tipRadius : rootRadius;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (step === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, rootRadius * 0.18, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.04, bevelThickness: 0.04 });
}

function wrapCaption(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fillPolygon(
  context: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
) {
  context.fillStyle = color;
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fill();
}

function drawDepthBlock(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  depth: number,
  topColor: string,
  frontColor: string,
  sideColor: string,
) {
  fillPolygon(context, [[x, y], [x + width, y], [x + width + depth * 0.58, y - depth * 0.45], [x + depth * 0.58, y - depth * 0.45]], topColor);
  fillPolygon(context, [[x, y], [x + width, y], [x + width, y + height], [x, y + height]], frontColor);
  fillPolygon(context, [[x + width, y], [x + width + depth * 0.58, y - depth * 0.45], [x + width + depth * 0.58, y + height - depth * 0.45], [x + width, y + height]], sideColor);
}

function drawSteelGear(context: CanvasRenderingContext2D, x: number, y: number, radius: number, teeth: number, angle: number) {
  context.save();
  context.translate(x, y);
  context.rotate(angle);
  context.shadowColor = "rgba(10,18,22,0.34)";
  context.shadowBlur = 12;
  const gearGradient = context.createLinearGradient(-radius, -radius, radius, radius);
  gearGradient.addColorStop(0, "#d9c196");
  gearGradient.addColorStop(0.45, "#88775d");
  gearGradient.addColorStop(1, "#4b5150");
  context.fillStyle = gearGradient;
  context.beginPath();
  for (let step = 0; step < teeth * 4; step += 1) {
    const angleAt = (step / (teeth * 4)) * Math.PI * 2;
    const tooth = step % 4 === 1 || step % 4 === 2;
    const pointRadius = tooth ? radius : radius * 0.82;
    const xAt = Math.cos(angleAt) * pointRadius;
    const yAt = Math.sin(angleAt) * pointRadius;
    if (step === 0) context.moveTo(xAt, yAt);
    else context.lineTo(xAt, yAt);
  }
  context.closePath();
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "rgba(239,223,190,0.72)";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#465157";
  context.beginPath();
  context.arc(0, 0, radius * 0.2, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawSoftwareConstruction(context: CanvasRenderingContext2D, time: number, progress: number) {
  const sky = context.createLinearGradient(0, 0, 0, 650);
  sky.addColorStop(0, "#9fb0b4");
  sky.addColorStop(0.56, "#c5c9c3");
  sky.addColorStop(1, "#e0d6c3");
  context.fillStyle = sky;
  context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

  const sun = context.createRadialGradient(525, 210, 8, 525, 210, 360);
  sun.addColorStop(0, "rgba(255,241,213,0.46)");
  sun.addColorStop(1, "rgba(255,241,213,0)");
  context.fillStyle = sun;
  context.fillRect(170, 0, 550, 580);

  const distantBuildings = [
    { x: 52, y: 422, w: 74, h: 148 },
    { x: 140, y: 368, w: 102, h: 202 },
    { x: 446, y: 330, w: 124, h: 240 },
    { x: 588, y: 396, w: 76, h: 174 },
  ];
  distantBuildings.forEach((building, index) => {
    const front = index === 2 ? "#8e9998" : "#98a3a0";
    drawDepthBlock(context, building.x, building.y, building.w, building.h, 28, "#bac0b7", front, "#6f7b7b");
    context.fillStyle = "rgba(205,219,218,0.48)";
    for (let row = 0; row < Math.floor(building.h / 27); row += 1) {
      for (let column = 0; column < Math.floor(building.w / 19); column += 1) {
        context.fillRect(building.x + 10 + column * 19, building.y + 14 + row * 27, 9, 13);
      }
    }
  });

  const cameraScale = 1 + Math.sin(progress * Math.PI) * 0.035;
  context.save();
  context.translate(FRAME_WIDTH * (1 - cameraScale) / 2 - Math.sin(progress * Math.PI) * 5, FRAME_HEIGHT * (1 - cameraScale) / 2);
  context.scale(cameraScale, cameraScale);

  const rigX = 244;
  const holeX = 368;
  const groundY = 596;
  const rigBase = context.createLinearGradient(140, 500, 320, 585);
  rigBase.addColorStop(0, "#707b7d");
  rigBase.addColorStop(0.5, "#3b484d");
  rigBase.addColorStop(1, "#252f33");
  drawDepthBlock(context, rigX - 79, 532, 144, 47, 28, "#7e8988", "#354247", "#252f32");
  context.fillStyle = rigBase;
  context.beginPath();
  context.roundRect(rigX - 81, 532, 152, 34, 14);
  context.fill();
  for (let wheel = 0; wheel < 5; wheel += 1) {
    context.fillStyle = wheel % 2 === 0 ? "#a5aaa5" : "#515b5d";
    context.beginPath();
    context.arc(rigX - 60 + wheel * 25, 553, 9, 0, Math.PI * 2);
    context.fill();
  }
  drawDepthBlock(context, rigX - 49, 468, 91, 62, 24, "#d7ad63", "#a77d3d", "#705733");
  context.fillStyle = "#b6c3c2";
  context.fillRect(rigX - 10, 472, 29, 34);
  context.fillStyle = "rgba(195,221,224,0.9)";
  context.fillRect(rigX - 6, 477, 19, 21);

  const mastTop = 199;
  context.strokeStyle = "#39464a";
  context.lineWidth = 13;
  context.beginPath();
  context.moveTo(rigX, groundY - 22);
  context.lineTo(rigX, mastTop);
  context.stroke();
  context.strokeStyle = "#aeb9b6";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(rigX - 24, groundY - 23);
  context.lineTo(rigX - 24, mastTop + 12);
  context.moveTo(rigX + 24, groundY - 23);
  context.lineTo(rigX + 24, mastTop + 12);
  context.stroke();
  context.lineWidth = 4;
  for (let braceY = mastTop + 22; braceY < groundY - 37; braceY += 45) {
    context.beginPath();
    context.moveTo(rigX - 24, braceY);
    context.lineTo(rigX + 24, braceY + 45);
    context.moveTo(rigX + 24, braceY);
    context.lineTo(rigX - 24, braceY + 45);
    context.stroke();
  }
  context.strokeStyle = "#526066";
  context.lineWidth = 11;
  context.beginPath();
  context.moveTo(rigX + 3, mastTop + 12);
  context.lineTo(holeX, 281);
  context.lineTo(holeX, 355);
  context.stroke();
  context.fillStyle = "#d2a45b";
  context.beginPath();
  context.roundRect(holeX - 27, 340, 54, 45, 8);
  context.fill();

  fillPolygon(context, [[34, groundY], [325, groundY], [325, 1090], [34, 1090]], "#92704f");
  fillPolygon(context, [[408, groundY], [692, groundY], [692, 1090], [408, 1090]], "#92704f");
  const layerColors = [
    ["#d4b68a", "#9b7956", "#745a42"],
    ["#c4a47d", "#856d53", "#67523f"],
    ["#aaa08c", "#777266", "#5c5952"],
    ["#91908a", "#656662", "#4b4d4c"],
  ];
  layerColors.forEach(([topColor, frontColor, sideColor], index) => {
    const y = groundY + index * 122;
    const leftX = 34 + index * 5;
    const leftWidth = 291 - index * 5;
    const rightX = 408;
    const rightWidth = 284 - index * 5;
    drawDepthBlock(context, leftX, y, leftWidth, 122, 31, topColor, frontColor, sideColor);
    drawDepthBlock(context, rightX, y, rightWidth, 122, 31, topColor, frontColor, sideColor);
    context.strokeStyle = "rgba(240,221,187,0.22)";
    context.lineWidth = 1;
    for (let line = 0; line < 4; line += 1) {
      const lineY = y + 20 + line * 25;
      context.beginPath();
      context.moveTo(leftX + 8, lineY);
      context.lineTo(leftX + leftWidth - 3, lineY + (line % 2 ? 1 : -1));
      context.moveTo(rightX + 2, lineY + 4);
      context.lineTo(rightX + rightWidth - 8, lineY);
      context.stroke();
    }
    for (let grain = 0; grain < 18; grain += 1) {
      const grainY = y + 10 + ((grain * 29 + index * 13) % 100);
      context.fillStyle = grain % 2 ? "rgba(35,32,27,0.12)" : "rgba(248,231,201,0.12)";
      context.fillRect(leftX + 12 + ((grain * 43) % Math.max(1, leftWidth - 24)), grainY, 3 + (grain % 4), 2);
      context.fillRect(rightX + 10 + ((grain * 31) % Math.max(1, rightWidth - 20)), grainY + 3, 4 + (grain % 3), 2);
    }
  });
  context.fillStyle = "#8b7458";
  context.fillRect(34, groundY - 8, 291, 10);
  context.fillRect(408, groundY - 8, 284, 10);

  const hammering = progress < 0.26;
  const drilling = progress >= 0.25 && progress < 0.57;
  const grouting = progress >= 0.49 && progress < 0.78;
  const planting = progress >= 0.66;
  if (hammering) {
    const bounce = Math.max(0, Math.sin(time * 11)) * 24;
    const hammerGradient = context.createLinearGradient(holeX - 25, 0, holeX + 28, 0);
    hammerGradient.addColorStop(0, "#735837");
    hammerGradient.addColorStop(0.5, "#e0b96c");
    hammerGradient.addColorStop(1, "#86683d");
    context.fillStyle = hammerGradient;
    context.fillRect(holeX - 21, 470 - bounce, 42, 78);
    context.fillStyle = "#404b4e";
    context.fillRect(holeX - 28, 532 - bounce, 56, 22);
    for (let ripple = 0; ripple < 3; ripple += 1) {
      context.strokeStyle = `rgba(242,220,177,${0.42 - ripple * 0.1})`;
      context.lineWidth = 2;
      context.beginPath();
      context.ellipse(holeX, groundY - 2, 28 + ripple * 19 + (time * 16) % 22, 7 + ripple * 5, 0, 0, Math.PI * 2);
      context.stroke();
    }
  }

  if (drilling) {
    const rotation = time * 5;
    const drillGradient = context.createLinearGradient(holeX - 18, 0, holeX + 20, 0);
    drillGradient.addColorStop(0, "#313d42");
    drillGradient.addColorStop(0.44, "#b8c0bc");
    drillGradient.addColorStop(0.62, "#e0e0d7");
    drillGradient.addColorStop(1, "#47545a");
    context.fillStyle = drillGradient;
    context.fillRect(holeX - 10, 356, 20, 604);
    context.strokeStyle = "#59676b";
    context.lineWidth = 7;
    context.beginPath();
    for (let y = 390; y <= 946; y += 16) {
      const x = holeX + Math.sin(y * 0.047 + rotation) * 24;
      if (y === 390) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.strokeStyle = "rgba(232,235,225,0.78)";
    context.lineWidth = 2;
    context.beginPath();
    for (let y = 390; y <= 946; y += 16) {
      const x = holeX + Math.sin(y * 0.047 + rotation) * 24;
      if (y === 390) context.moveTo(x + 4, y);
      else context.lineTo(x + 4, y);
    }
    context.stroke();
  }

  if (grouting || planting) {
    const groutHeight = grouting ? 270 + Math.max(0, Math.min(1, (progress - 0.49) / 0.19)) * 170 : 440;
    const groutGradient = context.createLinearGradient(holeX - 36, 0, holeX + 38, 0);
    groutGradient.addColorStop(0, "rgba(125,130,124,0.42)");
    groutGradient.addColorStop(0.42, "rgba(210,209,197,0.86)");
    groutGradient.addColorStop(0.7, "rgba(162,163,153,0.78)");
    groutGradient.addColorStop(1, "rgba(104,109,105,0.48)");
    context.fillStyle = groutGradient;
    context.fillRect(holeX - 34, groundY - groutHeight, 68, groutHeight);
    context.fillStyle = "rgba(234,232,216,0.8)";
    context.beginPath();
    context.ellipse(holeX, groundY, 34, 12, 0, 0, Math.PI * 2);
    context.fill();
  }

  if (planting) {
    const insertion = Math.max(0, Math.min(1, (progress - 0.66) / 0.23));
    const pileTop = groundY - 150 * (1 - insertion);
    const pileHeight = 420;
    const pileGradient = context.createLinearGradient(holeX - 30, 0, holeX + 33, 0);
    pileGradient.addColorStop(0, "#747773");
    pileGradient.addColorStop(0.2, "#d8d6cc");
    pileGradient.addColorStop(0.53, "#eeeae0");
    pileGradient.addColorStop(0.82, "#bbbcb6");
    pileGradient.addColorStop(1, "#696f6d");
    context.fillStyle = pileGradient;
    context.fillRect(holeX - 24, pileTop, 48, pileHeight);
    context.fillStyle = "#e2e0d7";
    context.beginPath();
    context.ellipse(holeX, pileTop, 24, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "rgba(75,80,77,0.42)";
    context.lineWidth = 2;
    for (let seam = 0; seam < 7; seam += 1) {
      const seamY = pileTop + 54 + seam * 51;
      context.beginPath();
      context.moveTo(holeX - 20, seamY);
      context.lineTo(holeX + 19, seamY - 2);
      context.stroke();
    }
  }

  context.restore();
}

function drawSoftwareMechanism(context: CanvasRenderingContext2D, time: number, progress: number) {
  const background = context.createLinearGradient(0, 0, 0, FRAME_HEIGHT);
  background.addColorStop(0, "#aab9bd");
  background.addColorStop(0.55, "#c9c7bd");
  background.addColorStop(1, "#706b61");
  context.fillStyle = background;
  context.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);

  const zoom = 1 + Math.sin(progress * Math.PI) * 0.035;
  context.save();
  context.translate(FRAME_WIDTH * (1 - zoom) / 2, FRAME_HEIGHT * (1 - zoom) / 2);
  context.scale(zoom, zoom);
  drawDepthBlock(context, 74, 330, 570, 552, 62, "#9aa19a", "#495257", "#353d41");
  drawDepthBlock(context, 115, 385, 492, 438, 34, "#c2c5bd", "#8f9895", "#626c70");
  const metalGradient = context.createLinearGradient(150, 390, 552, 780);
  metalGradient.addColorStop(0, "#35444a");
  metalGradient.addColorStop(0.43, "#899596");
  metalGradient.addColorStop(1, "#364248");
  drawDepthBlock(context, 148, 420, 426, 360, 26, "#a5aeaa", "#576267", "#394348");
  context.fillStyle = metalGradient;
  context.fillRect(181, 455, 356, 287);
  context.strokeStyle = "rgba(229,222,204,0.45)";
  context.lineWidth = 4;
  context.strokeRect(181, 455, 356, 287);

  drawSteelGear(context, 295, 566, 124, 18, time * 0.7);
  drawSteelGear(context, 454, 510, 91, 14, -time * 0.92);
  drawSteelGear(context, 446, 679, 62, 10, time * 1.3);

  const pistonY = Math.sin(time * 3.4) * 20;
  const piston = context.createLinearGradient(174, 0, 222, 0);
  piston.addColorStop(0, "#424f54");
  piston.addColorStop(0.42, "#ded5bf");
  piston.addColorStop(1, "#687378");
  context.fillStyle = piston;
  context.fillRect(161, 565 + pistonY, 48, 190);
  context.fillStyle = "#c2a36c";
  context.fillRect(176, 490 + pistonY, 17, 115);
  context.fillStyle = "rgba(246,225,183,0.6)";
  context.fillRect(165, 574 + pistonY, 5, 166);
  context.restore();
}

export class CinematicEngineeringScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, FRAME_WIDTH / FRAME_HEIGHT, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly random: () => number;
  private readonly foundation: boolean;
  private readonly animated: Array<(time: number, progress: number) => void> = [];
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly ownedTextures = new Set<THREE.Texture>();

  constructor(
    private readonly title: string,
    private readonly script: string,
    outputWidth: number,
    outputHeight: number,
  ) {
    this.foundation = FOUNDATION_TERMS.test(`${title} ${script}`);
    this.random = seededRandom(`${title}:${script}`);
    const probeCanvas = document.createElement("canvas");
    const webglAvailable = Boolean(probeCanvas.getContext("webgl2"));
    probeCanvas.remove();

    let renderer: THREE.WebGLRenderer | null = null;
    if (webglAvailable) {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          preserveDrawingBuffer: true,
        });
        renderer.setSize(outputWidth, outputHeight, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
      } catch {
        renderer = null;
      }
    }
    this.renderer = renderer;

    this.scene.background = new THREE.Color("#aabac1");
    this.scene.fog = new THREE.Fog("#aabac1", 22, 48);
    this.camera.position.set(14, 10.5, 25);
    this.camera.lookAt(0, 0.3, 0);

    if (this.renderer) {
      this.addLighting();
      if (this.foundation) this.buildFoundationScene();
      else this.buildMechanicalScene();
    }
  }

  private material(color: string, roughness: number, texture?: THREE.Texture, metalness = 0) {
    if (texture) this.ownedTextures.add(texture);
    const material = createMaterial(color, roughness, texture, metalness);
    this.ownedMaterials.add(material);
    return material;
  }

  private addLighting() {
    const hemisphere = new THREE.HemisphereLight("#eff7fa", "#5c4a39", 2.1);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight("#fff1d5", 3.4);
    sun.position.set(-10, 18, 13);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.00025;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight("#b9d5e3", 1.15);
    fill.position.set(10, 6, -12);
    this.scene.add(fill);
  }

  private buildFoundationScene() {
    const soilTexture = createSurfaceTexture("#92704f", this.title, "soil");
    const clayTexture = createSurfaceTexture("#766451", this.title, "soil");
    const rockTexture = createSurfaceTexture("#62605c", this.title, "concrete");
    const concreteTexture = createSurfaceTexture("#c4c4bb", this.title, "concrete");
    const steelTexture = createSurfaceTexture("#52616a", this.title, "steel");
    const soil = this.material("#d6b287", 0.98, soilTexture);
    const clay = this.material("#a88b67", 0.98, clayTexture);
    const rock = this.material("#85827c", 0.94, rockTexture);
    const concrete = this.material("#e0ded5", 0.86, concreteTexture);
    const steel = this.material("#8b979c", 0.43, steelTexture, 0.48);
    const darkSteel = this.material("#435158", 0.5, steelTexture, 0.52);
    const glass = this.material("#91aab4", 0.24, undefined, 0.18);
    const warmMetal = this.material("#d29a46", 0.42, steelTexture, 0.38);
    const holeX = -1.55;
    const gap = 0.94;
    const soilWidth = 16;
    const leftEdge = -soilWidth / 2;
    const rightEdge = soilWidth / 2;
    const leftWidth = holeX - gap - leftEdge;
    const rightWidth = rightEdge - holeX - gap;
    const leftCenter = leftEdge + leftWidth / 2;
    const rightCenter = holeX + gap + rightWidth / 2;
    const depth = 10;

    const addSplitLayer = (top: number, thickness: number, material: THREE.Material) => {
      const y = top - thickness / 2;
      addBox(this.scene, new THREE.Vector3(leftWidth, thickness, depth), new THREE.Vector3(leftCenter, y, 0), material);
      addBox(this.scene, new THREE.Vector3(rightWidth, thickness, depth), new THREE.Vector3(rightCenter, y, 0), material);
    };

    addSplitLayer(0, 1.8, soil);
    addSplitLayer(-1.8, 2.2, clay);
    addSplitLayer(-4, 2.2, rock);
    addSplitLayer(-6.2, 2.4, this.material("#696b69", 0.96, createSurfaceTexture("#696b69", this.title, "soil")));
    addSplitLayer(0.12, 0.16, this.material("#6b5a48", 0.98, soilTexture));

    this.addCityBackground(glass, concrete, darkSteel);
    this.addConstructionRig(steel, darkSteel, warmMetal, holeX);
    this.addEarthDetails(soil, rock);

    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.44, 7.45, 32, 1), concrete);
    pile.position.set(holeX, -3.45, 0.05);
    pile.castShadow = true;
    pile.receiveShadow = true;
    this.scene.add(pile);
    pile.visible = false;

    const pileCap = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.22, 32), concrete);
    pileCap.position.set(holeX, 0.1, 0.05);
    pileCap.castShadow = true;
    this.scene.add(pileCap);
    pileCap.visible = false;

    const augerGroup = new THREE.Group();
    augerGroup.position.set(holeX, 0.75, 0.05);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8.7, 18), darkSteel);
    shaft.position.y = -2.8;
    shaft.castShadow = true;
    augerGroup.add(shaft);
    const flightPoints: THREE.Vector3[] = [];
    for (let step = 0; step <= 280; step += 1) {
      const ratio = step / 280;
      const angle = ratio * Math.PI * 2 * 8;
      flightPoints.push(new THREE.Vector3(Math.cos(angle) * 0.42, -0.3 - ratio * 7.5, Math.sin(angle) * 0.42));
    }
    const flight = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(flightPoints), 320, 0.075, 8, false),
      steel,
    );
    flight.castShadow = true;
    augerGroup.add(flight);
    this.scene.add(augerGroup);
    augerGroup.visible = false;

    const groutGroup = new THREE.Group();
    const grout = new THREE.MeshStandardMaterial({
      color: "#aaa89e",
      roughness: 0.88,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });
    this.ownedMaterials.add(grout);
    const groutSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.67, 6.4, 32), grout);
    groutSleeve.position.set(holeX, -3.1, 0.06);
    groutSleeve.castShadow = true;
    groutGroup.add(groutSleeve);
    const groutRim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.08, 10, 40), grout);
    groutRim.rotation.x = Math.PI / 2;
    groutRim.position.set(holeX, 0.08, 0.06);
    groutGroup.add(groutRim);
    this.scene.add(groutGroup);
    groutGroup.visible = false;

    const hammer = new THREE.Group();
    const hammerHead = addBox(hammer, new THREE.Vector3(0.9, 1.4, 0.9), new THREE.Vector3(holeX, 1.2, 0.05), warmMetal);
    addBox(hammer, new THREE.Vector3(0.5, 0.36, 0.5), new THREE.Vector3(holeX, 0.26, 0.05), darkSteel);
    this.scene.add(hammer);
    hammer.visible = false;

    const vibrationMaterial = new THREE.MeshBasicMaterial({ color: "#f4d4a1", transparent: true, opacity: 0.44, side: THREE.DoubleSide });
    this.ownedMaterials.add(vibrationMaterial);
    const vibrationRings = [0, 1, 2].map((index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8 + index * 0.48, 0.018, 6, 64), vibrationMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(holeX, 0.09 + index * 0.025, 0.05);
      this.scene.add(ring);
      ring.visible = false;
      return ring;
    });

    this.animated.push((time, progress) => {
      const drilling = progress >= 0.25 && progress < 0.57;
      const grouting = progress >= 0.49 && progress < 0.76;
      const planting = progress >= 0.66 && progress < 0.9;
      const hammering = progress < 0.26;

      hammer.visible = hammering;
      hammerHead.position.y = 1.18 + (hammering ? Math.max(0, Math.sin(time * 11)) * 0.34 : 0);
      vibrationRings.forEach((ring, index) => {
        ring.visible = hammering;
        const ripple = 1 + ((time * 0.58 + index * 0.28) % 1) * 0.42;
        ring.scale.setScalar(ripple);
        vibrationMaterial.opacity = hammering ? 0.36 - ((time * 0.58 + index * 0.28) % 1) * 0.24 : 0;
      });

      augerGroup.visible = drilling;
      augerGroup.rotation.y = time * 2.4;
      augerGroup.position.y = 0.9 - Math.max(0, Math.min(1, (progress - 0.25) / 0.32)) * 0.55;

      groutGroup.visible = grouting || planting;
      groutSleeve.scale.y = grouting ? 0.48 + Math.max(0, Math.min(1, (progress - 0.49) / 0.19)) * 0.52 : 1;
      groutSleeve.position.y = -6.2 + groutSleeve.scale.y * 3.1;

      pile.visible = planting || progress >= 0.9;
      pileCap.visible = pile.visible;
      const insertion = planting ? Math.max(0, Math.min(1, (progress - 0.66) / 0.23)) : 1;
      pile.position.y = 1.45 - insertion * 4.9;
      pileCap.position.y = pile.position.y + 3.82;
      this.camera.position.x = 14 + Math.sin(progress * Math.PI) * 0.55;
      this.camera.position.y = 10.5 - Math.sin(progress * Math.PI * 0.8) * 0.65;
      this.camera.position.z = 25 - progress * 1.3;
      this.camera.lookAt(0, -0.25, 0);
    });
  }

  private addCityBackground(glass: THREE.Material, concrete: THREE.Material, darkSteel: THREE.Material) {
    const random = this.random;
    const buildings = [
      { x: -6.2, z: -5.8, width: 2.5, height: 5.2 },
      { x: -3.1, z: -7.5, width: 2.1, height: 6.8 },
      { x: 4.7, z: -5.7, width: 3, height: 8.5 },
      { x: 7.2, z: -7.2, width: 2.2, height: 5.4 },
    ];
    for (let buildingIndex = 0; buildingIndex < buildings.length; buildingIndex += 1) {
      const building = buildings[buildingIndex];
      addBox(
        this.scene,
        new THREE.Vector3(building.width, building.height, 1.8),
        new THREE.Vector3(building.x, building.height / 2 + 0.08, building.z),
        buildingIndex === 2 ? concrete : darkSteel,
      );
      const columns = Math.max(2, Math.floor(building.width / 0.42));
      const floors = Math.floor(building.height / 0.58);
      for (let floor = 0; floor < floors; floor += 1) {
        for (let column = 0; column < columns; column += 1) {
          const windowPane = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.25, 0.035),
            random() > 0.28 ? glass : concrete,
          );
          windowPane.position.set(
            building.x - building.width / 2 + 0.32 + column * 0.42,
            0.5 + floor * 0.56,
            building.z + 0.92,
          );
          this.scene.add(windowPane);
        }
      }
    }
  }

  private addConstructionRig(steel: THREE.Material, darkSteel: THREE.Material, warmMetal: THREE.Material, holeX: number) {
    const rig = new THREE.Group();
    const rigX = holeX - 2.4;
    addBox(rig, new THREE.Vector3(2.9, 0.54, 1.25), new THREE.Vector3(rigX, 0.58, -0.75), darkSteel);
    addBox(rig, new THREE.Vector3(1.75, 1.1, 1.18), new THREE.Vector3(rigX - 0.12, 1.3, -0.72), warmMetal);
    addBox(rig, new THREE.Vector3(0.82, 0.68, 1.2), new THREE.Vector3(rigX + 0.55, 1.52, -0.68), steel);

    for (const side of [-1, 1]) {
      const track = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.22, 20), darkSteel);
      track.rotation.x = Math.PI / 2;
      track.position.set(rigX + side * 0.98, 0.52, -1.42);
      rig.add(track);
      const farTrack = track.clone();
      farTrack.position.z = -0.05;
      rig.add(farTrack);
      addBox(rig, new THREE.Vector3(0.44, 0.32, 1.7), new THREE.Vector3(rigX + side * 0.98, 0.54, -0.74), darkSteel);
    }

    const mastX = rigX + 0.34;
    const mastBottom = new THREE.Vector3(mastX, 1.75, -0.72);
    const mastTop = new THREE.Vector3(mastX, 9.3, -0.72);
    addBeam(rig, mastBottom, mastTop, 0.12, steel, 10);
    addBeam(rig, new THREE.Vector3(mastX - 0.44, 1.85, -0.72), new THREE.Vector3(mastX - 0.44, 9.1, -0.72), 0.075, darkSteel, 8);
    addBeam(rig, new THREE.Vector3(mastX + 0.44, 1.85, -0.72), new THREE.Vector3(mastX + 0.44, 9.1, -0.72), 0.075, darkSteel, 8);
    for (let height = 2.2; height < 8.8; height += 1.05) {
      addBeam(rig, new THREE.Vector3(mastX - 0.44, height, -0.72), new THREE.Vector3(mastX + 0.44, height + 1.05, -0.72), 0.035, steel, 6);
      addBeam(rig, new THREE.Vector3(mastX + 0.44, height, -0.72), new THREE.Vector3(mastX - 0.44, height + 1.05, -0.72), 0.035, steel, 6);
    }
    addBeam(rig, new THREE.Vector3(mastX, 8.55, -0.72), new THREE.Vector3(holeX, 7.6, 0.05), 0.11, darkSteel);
    addBeam(rig, new THREE.Vector3(mastX, 7.65, -0.72), new THREE.Vector3(holeX, 7.65, 0.05), 0.09, steel);
    addBox(rig, new THREE.Vector3(1.2, 0.55, 1.05), new THREE.Vector3(holeX, 7.18, 0.05), warmMetal);
    this.scene.add(rig);
  }

  private addEarthDetails(soil: THREE.Material, rock: THREE.Material) {
    const random = this.random;
    const rubbleMaterials = [soil, rock];
    for (let index = 0; index < 32; index += 1) {
      const x = -7 + random() * 14;
      const z = 4.9 + random() * 1.2;
      if (Math.abs(x + 1.55) < 1.2) continue;
      const size = 0.1 + random() * 0.24;
      const stone = new THREE.Mesh(
        new THREE.DodecahedronGeometry(size, 0),
        rubbleMaterials[Math.floor(random() * rubbleMaterials.length)],
      );
      stone.position.set(x, size * 0.38, z);
      stone.rotation.set(random(), random(), random());
      stone.castShadow = true;
      this.scene.add(stone);
    }
  }

  private buildMechanicalScene() {
    this.scene.background = new THREE.Color("#a7b5bb");
    this.scene.fog = new THREE.Fog("#a7b5bb", 22, 50);
    const steelTexture = createSurfaceTexture("#65727a", this.title, "steel");
    const darkTexture = createSurfaceTexture("#39444a", this.title, "steel");
    const steel = this.material("#b8c1c3", 0.38, steelTexture, 0.7);
    const darkSteel = this.material("#56646b", 0.52, darkTexture, 0.66);
    const brass = this.material("#d0a45d", 0.35, undefined, 0.62);
    const casing = this.material("#718088", 0.56, steelTexture, 0.48);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 28),
      this.material("#5d625f", 0.96, createSurfaceTexture("#5d625f", this.title, "concrete")),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    addBox(this.scene, new THREE.Vector3(8.2, 6.6, 3.1), new THREE.Vector3(0, -0.6, 0), casing);
    addBox(
      this.scene,
      new THREE.Vector3(5.6, 4.8, 0.3),
      new THREE.Vector3(0, -0.6, 1.72),
      this.material("#aab4b5", 0.82, undefined, 0.3),
    );

    const gearMaterial = brass;
    const gearMeshes: THREE.Mesh[] = [];
    const gearSpecs = [
      { x: -1.55, y: -0.7, radius: 1.65, teeth: 16, speed: 1 },
      { x: 1.3, y: 0.42, radius: 1.2, teeth: 12, speed: -1.34 },
      { x: 1.15, y: -2.45, radius: 0.75, teeth: 10, speed: 1.8 },
    ];
    for (const gear of gearSpecs) {
      const mesh = new THREE.Mesh(createGearGeometry(gear.teeth, gear.radius * 0.82, gear.radius, 0.26), gearMaterial);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(gear.x, gear.y, 1.95);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      gearMeshes.push(mesh);
    }

    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 3.6, 24), darkSteel);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(-1.55, -0.7, 2.04);
    axle.castShadow = true;
    this.scene.add(axle);
    const piston = new THREE.Group();
    const pistonBody = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.8, 24), steel);
    pistonBody.position.set(-3.05, -2.2, 1.95);
    pistonBody.castShadow = true;
    piston.add(pistonBody);
    const pistonRod = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.7, 16), brass);
    pistonRod.position.set(-3.05, -0.05, 1.95);
    pistonRod.castShadow = true;
    piston.add(pistonRod);
    this.scene.add(piston);

    const bolts = this.material("#303a40", 0.5, undefined, 0.7);
    for (let index = 0; index < 20; index += 1) {
      const angle = (index / 20) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), bolts);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.cos(angle) * 2.1, Math.sin(angle) * 2.1 - 0.6, 1.95);
      this.scene.add(bolt);
    }

    addBox(this.scene, new THREE.Vector3(0.18, 6.2, 0.42), new THREE.Vector3(-4.22, -0.55, 0.05), darkSteel);
    addBox(this.scene, new THREE.Vector3(0.18, 6.2, 0.42), new THREE.Vector3(4.22, -0.55, 0.05), darkSteel);
    this.camera.position.set(12.8, 9.6, 25);
    this.camera.lookAt(0, -0.25, 0);

    this.animated.push((time, progress) => {
      gearMeshes.forEach((gear, index) => {
        const speed = gearSpecs[index].speed;
        gear.rotation.z = time * speed;
      });
      piston.position.y = Math.sin(time * 3.4) * 0.38;
      this.camera.position.x = 12.8 + Math.sin(progress * Math.PI) * 0.6;
      this.camera.position.z = 25 - progress * 1.4;
      this.camera.lookAt(0, -0.25, 0);
    });
  }

  renderFrame(
    context: CanvasRenderingContext2D,
    segments: string[],
    elapsed: number,
    duration: number,
  ) {
    const progress = Math.min(1, elapsed / duration);
    if (this.renderer) {
      this.animated.forEach((update) => update(elapsed, progress));
      this.renderer.render(this.scene, this.camera);
      context.drawImage(this.renderer.domElement, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    } else if (this.foundation) {
      drawSoftwareConstruction(context, elapsed, progress);
    } else {
      drawSoftwareMechanism(context, elapsed, progress);
    }
    this.drawTypography(context, segments, progress);
  }

  private drawTypography(context: CanvasRenderingContext2D, segments: string[], progress: number) {
    const topShade = context.createLinearGradient(0, 0, 0, 270);
    topShade.addColorStop(0, "rgba(16, 24, 29, 0.66)");
    topShade.addColorStop(1, "rgba(16, 24, 29, 0)");
    context.fillStyle = topShade;
    context.fillRect(0, 0, FRAME_WIDTH, 270);

    const lowerShade = context.createLinearGradient(0, 850, 0, FRAME_HEIGHT);
    lowerShade.addColorStop(0, "rgba(12, 17, 20, 0)");
    lowerShade.addColorStop(0.34, "rgba(12, 17, 20, 0.72)");
    lowerShade.addColorStop(1, "rgba(12, 17, 20, 0.94)");
    context.fillStyle = lowerShade;
    context.fillRect(0, 850, FRAME_WIDTH, FRAME_HEIGHT - 850);

    context.save();
    context.textAlign = "left";
    context.fillStyle = "#e8c27d";
    context.font = `700 16px ${FRAME_FONT}`;
    context.fillText(this.foundation ? "ENGINEERING FILM  /  FOUNDATION" : "ENGINEERING FILM  /  MECHANISM", 48, 72);
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.font = `800 40px ${FRAME_FONT}`;
    context.shadowColor = "rgba(0,0,0,0.35)";
    context.shadowBlur = 14;
    const titleLines = wrapCaption(context, this.title, FRAME_WIDTH - 96).slice(0, 2);
    titleLines.forEach((line, index) => context.fillText(line, 48, 134 + index * 50));

    const segmentIndex = Math.min(segments.length - 1, Math.floor(progress * segments.length));
    const caption = segments[segmentIndex] ?? "";
    context.font = `800 36px ${FRAME_FONT}`;
    context.textAlign = "center";
    context.fillStyle = "#fffdf8";
    context.shadowColor = "rgba(0,0,0,0.74)";
    context.shadowBlur = 12;
    const captionLines = wrapCaption(context, caption, FRAME_WIDTH - 96).slice(0, 3);
    captionLines.forEach((line, index) => {
      context.fillStyle = index === 0 ? "#f4d49a" : "#fffdf8";
      context.fillText(line, FRAME_WIDTH / 2, 1082 + index * 48);
    });

    context.shadowBlur = 0;
    context.fillStyle = "rgba(255,255,255,0.28)";
    context.fillRect(48, 1228, FRAME_WIDTH - 96, 2);
    context.fillStyle = "#e8c27d";
    context.fillRect(48, 1228, (FRAME_WIDTH - 96) * progress, 2);
    context.restore();
  }

  dispose() {
    if (this.renderer) {
      this.scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedTextures.forEach((texture) => texture.dispose());
  }
}
