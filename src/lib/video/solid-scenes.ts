import * as THREE from "three";
import { sceneShotIndex, sceneVariantFor, type ScenePreset } from "./scene-classifier";

let webGlAvailable: boolean | undefined;

const SHOT_COMPOSITIONS = [
  { distance: 1, height: 5.5, targetY: -0.2, yaw: 0.45, fov: 38, modelYaw: 0 },
  { distance: 1.15, height: 8.4, targetY: -0.1, yaw: 1.45, fov: 42, modelYaw: 0.32 },
  { distance: 0.78, height: 3.6, targetY: 0.4, yaw: 2.7, fov: 34, modelYaw: -0.42 },
  { distance: 1.08, height: 10, targetY: -0.35, yaw: 4.1, fov: 46, modelYaw: 0.6 },
] as const;

export function supportsWebGL() {
  if (webGlAvailable !== undefined) return webGlAvailable;
  if (typeof document === "undefined") return false;

  let probeRenderer: THREE.WebGLRenderer | undefined;
  try {
    const probe = document.createElement("canvas");
    probeRenderer = new THREE.WebGLRenderer({ canvas: probe, antialias: false, alpha: false });
    webGlAvailable = true;
  } catch {
    webGlAvailable = false;
  } finally {
    probeRenderer?.dispose();
    probeRenderer?.forceContextLoss();
  }

  return webGlAvailable;
}

/** Browser-only solid educational scenes; loaded after hydration, never during SSR. */
export function createSolidScenes(width: number, height: number) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#c9d4dc");
  scene.fog = new THREE.Fog("#c9d4dc", 24, 55);
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  scene.add(new THREE.HemisphereLight("#eaf5ff", "#687469", 2.3));
  const sun = new THREE.DirectionalLight("#fff5e3", 3.5);
  sun.position.set(-7, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#d7edff", 1.5);
  fill.position.set(6, 5, -8);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({ color: "#aebcc2", roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.3;
  floor.receiveShadow = true;
  scene.add(floor);
  const groups = new Map<string, THREE.Group>();
  const groupMaterials = new Map<THREE.Group, Set<THREE.Material>>();
  const animated: Array<(t: number) => void> = [];
  let active = "";
  let buildingMaterials: Set<THREE.Material> | null = null;
  const material = (color: string, metalness = 0.2) => {
    const created = new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness });
    buildingMaterials?.add(created);
    return created;
  };
  const steel = material("#7b8c99", 0.8),
    yellow = material("#f3bc35"),
    red = material("#e74739"),
    white = material("#f0f2ec");
  function mesh(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const item = new THREE.Mesh(geo, mat);
    item.position.set(x, y, z);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) {
    return mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  }
  function cylinder(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    mat: THREE.Material,
  ) {
    return mesh(parent, new THREE.CylinderGeometry(r, r, h, 40), mat, x, y, z);
  }
  function rod(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    r: number,
    mat: THREE.Material,
  ) {
    const item = cylinder(parent, 0, 0, 0, r, a.distanceTo(b), mat);
    item.position.copy(a).add(b).multiplyScalar(0.5);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return item;
  }
  function tube(
    parent: THREE.Object3D,
    points: THREE.Vector3[],
    radius: number,
    mat: THREE.Material,
  ) {
    const curve = new THREE.CatmullRomCurve3(points);
    return mesh(
      parent,
      new THREE.TubeGeometry(curve, Math.max(32, points.length * 3), radius, 8),
      mat,
    );
  }
  function arrow(
    parent: THREE.Object3D,
    from: THREE.Vector3,
    to: THREE.Vector3,
    mat: THREE.Material,
  ) {
    const direction = to.clone().sub(from).normalize();
    const length = from.distanceTo(to);
    const headLength = Math.min(0.36, length * 0.24);
    rod(parent, from, to.clone().addScaledVector(direction, -headLength), 0.045, mat);
    const head = mesh(
      parent,
      new THREE.ConeGeometry(headLength * 0.42, headLength, 18),
      mat,
      to.x - direction.x * headLength * 0.5,
      to.y - direction.y * headLength * 0.5,
      to.z - direction.z * headLength * 0.5,
    );
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  }
  function build(key: string) {
    const [sceneType, variant] = key.split(":");
    const ownedMaterials = new Set<THREE.Material>();
    buildingMaterials = ownedMaterials;
    const root = new THREE.Group();
    groups.set(key, root);
    scene.add(root);
    if (sceneType === "construction") {
      const soil = material("#967e62");
      box(root, 0, -1.7, 0, 8, 1.2, 6, soil);
      for (let x = -2; x <= 2; x += 2)
        for (let z = -1.5; z <= 1.5; z += 1.5) cylinder(root, x, -0.7, z, 0.28, 2.2, white);
      const rig = new THREE.Group();
      root.add(rig);
      rig.position.set(1.7, 0, 0);
      box(rig, 0, -0.7, 0, 1.8, 0.55, 1.5, yellow);
      box(rig, -0.7, -1.1, 0, 0.45, 0.45, 2, steel);
      box(rig, 0.7, -1.1, 0, 0.45, 0.45, 2, steel);
      for (const x of [-0.4, 0.4])
        rod(rig, new THREE.Vector3(x, -0.5, -0.4), new THREE.Vector3(x, 4, -0.4), 0.08, yellow);
      for (let y = 0; y < 4; y += 0.5)
        rod(
          rig,
          new THREE.Vector3(-0.4, y, -0.4),
          new THREE.Vector3(0.4, y + 0.5, -0.4),
          0.05,
          yellow,
        );
      const drill = new THREE.Group();
      rig.add(drill);
      cylinder(drill, 0, 0.5, -0.55, 0.09, 3.8, steel);
      for (let i = 0; i < 14; i++) {
        const fin = mesh(
          drill,
          new THREE.TorusGeometry(0.28, 0.05, 8, 32, Math.PI * 1.65),
          steel,
          0,
          -1.1 + i * 0.22,
          -0.55,
        );
        fin.rotation.x = Math.PI / 2;
        fin.rotation.z = i * 0.5;
      }
      animated.push((t) => {
        drill.rotation.y = t * 2;
        drill.position.y = 0.2 + Math.sin(t * 0.8) * 0.45;
      });
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(-1.4, 2, 0),
        1.5,
        0xe74739,
        0.35,
        0.25,
      );
      root.add(arrow);
    } else if (sceneType === "chip" && variant === "wafer") {
      const wafer = material("#9bacb8", 0.72);
      cylinder(root, 0, -0.45, 0, 2.7, 0.16, wafer);
      const rim = mesh(
        root,
        new THREE.TorusGeometry(2.62, 0.055, 10, 72),
        material("#61d8e7"),
        0,
        -0.34,
        0,
      );
      rim.rotation.x = Math.PI / 2;
      const dieColors = ["#286e7b", "#3b8b91", "#365c87", "#7b6b47"];
      for (let x = -1.5; x <= 1.5; x += 1) {
        for (let z = -1.5; z <= 1.5; z += 1) {
          box(
            root,
            x,
            -0.33,
            z,
            0.78,
            0.055,
            0.78,
            material(dieColors[(x + z + 6) % dieColors.length], 0.58),
          );
        }
      }
      const scan = box(root, 0, -0.25, -2.3, 5, 0.035, 0.08, yellow);
      animated.push((t) => {
        scan.position.z = -2.3 + ((t * 0.72) % 1) * 4.6;
      });
    } else if (sceneType === "chip") {
      const board = material("#305d4b");
      box(root, 0, -1, 0, 7, 0.18, 6, board);
      box(root, 0, -0.65, 0, 3, 0.55, 3, steel);
      box(root, 0, -0.27, 0, 1.8, 0.2, 1.8, material("#274d6f", 0.7));
      for (let i = -1.2; i <= 1.2; i += 0.3)
        for (const side of [-1, 1]) {
          box(root, i, -0.85, side * 1.75, 0.12, 0.1, 0.55, white);
          box(root, side * 1.75, -0.85, i, 0.55, 0.1, 0.12, white);
        }
      for (let x = -3; x <= 3; x += 1)
        for (let z = -2; z <= 2; z += 1)
          if (Math.abs(x) > 1 || Math.abs(z) > 1)
            box(root, x, -0.73, z, 0.35, 0.4, 0.45, material("#cab88b"));
      const lid = box(root, 0, 0.7, 0, 2.7, 0.15, 2.7, material("#c8d2d5", 0.85));
      animated.push((t) => {
        lid.position.y = 0.8 + Math.sin(t * 0.6) * 0.35;
      });
    } else if (sceneType === "robot" && variant === "gearbox") {
      const housing = material("#233541", 0.88);
      const rim = material("#8799a3", 0.82);
      const warmClutch = material("#e8634f", 0.6);
      const coolClutch = material("#4bc8dc", 0.6);
      box(root, 0, -1.45, 0, 5.6, 0.32, 3.5, housing);
      box(root, 0, 1.25, 0, 5.6, 0.16, 3.5, rim);
      box(root, -2.72, -0.05, 0, 0.16, 2.6, 3.5, housing);
      box(root, 2.72, -0.05, 0, 0.16, 2.6, 3.5, housing);
      const cutaway = material("#476271", 0.45);
      cutaway.transparent = true;
      cutaway.opacity = 0.2;
      cutaway.depthWrite = false;
      box(root, 0, -0.05, -1.43, 5.25, 2.45, 0.08, cutaway);

      for (const x of [-0.65, 0.65]) {
        const shaft = cylinder(root, x, 0.05, 0, 0.12, 2.55, rim);
        shaft.rotation.x = Math.PI / 2;
      }

      const makeGear = (
        x: number,
        z: number,
        radius: number,
        teeth: number,
        mat: THREE.Material,
      ) => {
        const gear = new THREE.Group();
        root.add(gear);
        gear.position.set(x, 0.05, z);
        const face = cylinder(gear, 0, 0, 0, radius * 0.72, 0.32, mat);
        face.rotation.x = Math.PI / 2;
        const hub = cylinder(gear, 0, 0, 0, radius * 0.24, 0.42, rim);
        hub.rotation.x = Math.PI / 2;
        for (let i = 0; i < teeth; i++) {
          const angle = (i / teeth) * Math.PI * 2;
          const tooth = box(
            gear,
            Math.cos(angle) * radius * 0.91,
            Math.sin(angle) * radius * 0.91,
            0,
            radius * 0.3,
            radius * 0.26,
            0.34,
            mat,
          );
          tooth.rotation.z = angle;
        }
        return gear;
      };
      const firstDrive = makeGear(-0.65, -0.48, 0.66, 18, yellow);
      const firstDriven = makeGear(0.65, -0.48, 0.64, 18, rim);
      const secondDrive = makeGear(-0.65, 0.48, 0.43, 12, rim);
      const secondDriven = makeGear(0.65, 0.48, 0.82, 24, yellow);
      animated.push((t) => {
        firstDrive.rotation.z = t * 0.82;
        firstDriven.rotation.z = -t * 0.82;
        secondDrive.rotation.z = t * 1.56;
        secondDriven.rotation.z = -t * 0.82;
      });

      const clutchPacks = [
        { x: -2.03, color: warmClutch, phase: 0 },
        { x: 2.03, color: coolClutch, phase: Math.PI },
      ];
      clutchPacks.forEach(({ x, color, phase }) => {
        const pack = new THREE.Group();
        root.add(pack);
        pack.position.set(x, 0.05, 0.2);
        for (let i = 0; i < 6; i++) {
          const plate = cylinder(
            pack,
            0,
            0,
            (i - 2.5) * 0.15,
            0.38,
            0.075,
            i % 2 === 0 ? color : rim,
          );
          plate.rotation.x = Math.PI / 2;
        }
        const center = cylinder(pack, 0, 0, 0, 0.14, 1.05, housing);
        center.rotation.x = Math.PI / 2;
        animated.push((t) => {
          pack.rotation.z = Math.sin(t * 0.75 + phase) * 0.06;
        });
      });

      const selector = mesh(
        root,
        new THREE.TorusGeometry(0.5, 0.055, 10, 40),
        yellow,
        0.65,
        0.05,
        0.82,
      );
      animated.push((t) => {
        selector.position.z = 0.82 + Math.sin(t * 0.85) * 0.18;
      });
      root.scale.setScalar(0.9);
    } else if (sceneType === "robot" && variant === "arm") {
      cylinder(root, 0, -1.55, 0, 1.25, 0.35, steel);
      const turret = new THREE.Group();
      root.add(turret);
      turret.position.y = -1.3;
      cylinder(turret, 0, 0.15, 0, 0.7, 0.55, steel);
      const shoulder = new THREE.Group();
      turret.add(shoulder);
      shoulder.position.set(0, 0.45, 0);
      mesh(shoulder, new THREE.SphereGeometry(0.42, 28, 20), yellow, 0, 0.48, 0);
      box(shoulder, 0, 1.15, 0, 0.58, 1.45, 0.62, steel);
      const elbow = new THREE.Group();
      shoulder.add(elbow);
      elbow.position.y = 1.78;
      mesh(elbow, new THREE.SphereGeometry(0.32, 24, 18), yellow);
      box(elbow, 0, 0.65, 0, 0.44, 1.3, 0.46, red);
      const gripper = new THREE.Group();
      elbow.add(gripper);
      gripper.position.y = 1.35;
      cylinder(gripper, 0, 0, 0, 0.2, 0.35, steel);
      for (const side of [-1, 1]) {
        rod(
          gripper,
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(side * 0.45, 0.55, 0),
          0.07,
          yellow,
        );
        rod(
          gripper,
          new THREE.Vector3(side * 0.45, 0.55, 0),
          new THREE.Vector3(side * 0.55, 0.95, 0),
          0.055,
          yellow,
        );
      }
      animated.push((t) => {
        turret.rotation.y = Math.sin(t * 0.45) * 0.62;
        shoulder.rotation.z = -0.45 + Math.sin(t * 0.85) * 0.24;
        elbow.rotation.z = 0.55 + Math.sin(t * 1.1 + 0.6) * 0.28;
        gripper.rotation.x = Math.sin(t * 1.6) * 0.2;
      });
    } else if (sceneType === "robot") {
      box(root, 0, -1.6, 0, 4.5, 0.7, 3, steel);
      const engine = new THREE.Group();
      root.add(engine);
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 1.35;
        const housing = cylinder(engine, x, -0.2, 0, 0.55, 1.8, steel);
        housing.material = new THREE.MeshStandardMaterial({
          color: "#aebac3",
          transparent: true,
          opacity: 0.26,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        ownedMaterials.add(housing.material);
        const piston = cylinder(engine, x, 0, 0, 0.43, 0.45, white);
        const shaft = cylinder(engine, x, -0.8, 0, 0.12, 1.3, yellow);
        animated.push((t) => {
          const y = Math.sin(t * 2 + i * 2) * 0.55;
          piston.position.y = y;
          shaft.position.y = y - 0.8;
        });
      }
      const gear = new THREE.Group();
      root.add(gear);
      gear.position.set(0, -1.3, 1.7);
      gear.rotation.x = Math.PI / 2;
      cylinder(gear, 0, 0, 0, 0.85, 0.25, yellow);
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        const tooth = box(gear, Math.cos(a) * 0.88, 0, Math.sin(a) * 0.88, 0.3, 0.28, 0.3, yellow);
        tooth.rotation.y = -a;
      }
      animated.push((t) => {
        gear.rotation.y = t;
      });
    } else if (sceneType === "network" && variant === "topology") {
      const hub = mesh(root, new THREE.IcosahedronGeometry(0.58, 2), yellow);
      const nodes: THREE.Vector3[] = [];
      const ringMaterials = [material("#4cc9ff"), material("#6b7cff"), material("#22d3ee")];
      for (let ring = 0; ring < 3; ring++) {
        const radius = 1.2 + ring * 0.72;
        const y = (ring - 1) * 1.15;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + ring * 0.22;
          const point = new THREE.Vector3(
            Math.cos(angle) * radius,
            y + Math.sin(angle) * 0.25,
            Math.sin(angle) * radius,
          );
          nodes.push(point);
          mesh(
            root,
            new THREE.SphereGeometry(0.16, 18, 14),
            ringMaterials[ring],
            point.x,
            point.y,
            point.z,
          );
          rod(root, new THREE.Vector3(0, 0, 0), point, 0.025, ringMaterials[ring]);
          if (i > 0) rod(root, nodes[nodes.length - 2], point, 0.022, ringMaterials[ring]);
        }
      }
      const packet = mesh(root, new THREE.SphereGeometry(0.11, 16, 12), red);
      animated.push((t) => {
        packet.position.copy(nodes[Math.floor(t * 4) % nodes.length]);
      });
      hub.scale.setScalar(1.1);
    } else if (sceneType === "network" && (variant === "economy" || variant === "timeline")) {
      const accent = variant === "economy" ? material("#45d7b4", 0.35) : material("#f3bc35", 0.35);
      const secondary = material(variant === "economy" ? "#6682ee" : "#e86f64", 0.45);
      const grid = material("#647889", 0.2);
      for (let y = -1; y <= 1; y++)
        rod(
          root,
          new THREE.Vector3(-3.2, y * 0.75, 0),
          new THREE.Vector3(3.2, y * 0.75, 0),
          0.012,
          grid,
        );
      rod(root, new THREE.Vector3(-3.1, -1.55, 0), new THREE.Vector3(3.1, -1.55, 0), 0.035, steel);
      const heights =
        variant === "economy"
          ? [0.8, 1.35, 1.05, 1.8, 1.45, 2.35, 2.05]
          : [1.9, 1.25, 1.55, 0.85, 1.35, 0.7, 1.1];
      const points: THREE.Vector3[] = [];
      heights.forEach((height, index) => {
        const x = -2.55 + index * 0.85;
        const y = -1.52 + height / 2;
        box(root, x, y, 0.15, 0.46, height, 0.42, index % 2 === 0 ? accent : secondary);
        points.push(new THREE.Vector3(x, -1.52 + height + 0.12, 0.45));
      });
      tube(root, points, 0.045, yellow);
      const marker = mesh(root, new THREE.SphereGeometry(0.13, 20, 16), red);
      animated.push((t) => {
        marker.position.copy(points[Math.floor(t * 2.5) % points.length]);
      });
    } else if (sceneType === "network") {
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 1.25;
        box(root, x, 0, 0, 0.95, 3.8, 1.6, steel);
        for (let j = 0; j < 8; j++) {
          box(root, x, -1.4 + j * 0.42, 0.83, 0.8, 0.28, 0.04, material("#253740"));
          box(root, x + 0.28, -1.4 + j * 0.42, 0.88, 0.08, 0.06, 0.02, material("#5ee5aa"));
        }
        if (i < 4)
          rod(
            root,
            new THREE.Vector3(x, -1.8, 1.3),
            new THREE.Vector3(x + 1.25, -1.8, 1.3),
            0.04,
            yellow,
          );
      }
      const packet = mesh(root, new THREE.SphereGeometry(0.12, 16, 16), red, 0, -1.8, 1.3);
      animated.push((t) => {
        packet.position.x = -2.5 + ((t * 1.4) % 5);
      });
    } else if (sceneType === "space" && variant === "wave") {
      floor.visible = false;
      scene.background = new THREE.Color("#0a1422");
      scene.fog = null;
      const waveColors = [material("#43d2f4", 0.28), material("#a484fa", 0.28)];
      const waves: THREE.Vector3[][] = [];
      for (let row = 0; row < 2; row++) {
        const points = Array.from({ length: 73 }, (_, i) => {
          const x = -3.5 + (i / 72) * 7;
          return new THREE.Vector3(
            x,
            Math.sin(x * 1.8 + row * 0.8) * (row === 0 ? 0.72 : 0.48) + row * 0.6,
            row * 0.5,
          );
        });
        waves.push(points);
        tube(root, points, row === 0 ? 0.055 : 0.035, waveColors[row]);
        rod(
          root,
          new THREE.Vector3(-3.5, row * 0.6, row * 0.5),
          new THREE.Vector3(3.5, row * 0.6, row * 0.5),
          0.015,
          steel,
        );
      }
      const pulse = mesh(root, new THREE.SphereGeometry(0.16, 24, 18), yellow);
      animated.push((t) => {
        const points = waves[0];
        pulse.position.copy(points[Math.floor(t * 9) % points.length]);
      });
    } else if (sceneType === "space" && variant === "field") {
      floor.visible = false;
      scene.background = new THREE.Color("#081321");
      scene.fog = null;
      const coreMaterial = material("#4cc9ff", 0.35);
      coreMaterial.emissive.set("#063d66");
      coreMaterial.emissiveIntensity = 0.7;
      mesh(root, new THREE.SphereGeometry(0.66, 40, 32), coreMaterial);
      const fieldColors = [
        material("#f1ba4b", 0.25),
        material("#43c7dd", 0.25),
        material("#e86a7a", 0.25),
      ];
      for (let i = 0; i < 3; i++) {
        const ring = mesh(
          root,
          new THREE.TorusGeometry(1.35 + i * 0.52, 0.025, 8, 80),
          fieldColors[i],
        );
        ring.rotation.x = (Math.PI / 2) * (i % 2 ? 0.78 : 1);
        ring.rotation.y = i * 0.42;
      }
      const particle = mesh(root, new THREE.SphereGeometry(0.12, 18, 14), white);
      animated.push((t) => {
        particle.position.set(
          Math.cos(t * 0.8) * 2.25,
          Math.sin(t * 0.8) * 0.5,
          Math.sin(t * 0.8) * 2.25,
        );
      });
    } else if (sceneType === "space" && variant === "molecule") {
      floor.visible = false;
      scene.background = new THREE.Color("#101925");
      scene.fog = null;
      const molecule = new THREE.Group();
      root.add(molecule);
      const carbon = material("#718394", 0.55);
      const hydrogen = material("#f2eee3", 0.18);
      const oxygen = material("#e75b53", 0.35);
      const positions = Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * 1.28, Math.sin(angle) * 1.28, 0);
      });
      positions.forEach((position, index) => {
        const next = positions[(index + 1) % positions.length];
        rod(molecule, position, next, 0.055, white);
        mesh(
          molecule,
          new THREE.SphereGeometry(0.28, 24, 18),
          index === 1 ? oxygen : carbon,
          position.x,
          position.y,
          position.z,
        );
        const outer = position.clone().multiplyScalar(1.55);
        rod(molecule, position, outer, 0.035, hydrogen);
        mesh(molecule, new THREE.SphereGeometry(0.14, 18, 14), hydrogen, outer.x, outer.y, outer.z);
      });
      const innerBond = mesh(
        molecule,
        new THREE.TorusGeometry(0.62, 0.025, 8, 60),
        material("#48d7d0", 0.28),
      );
      innerBond.position.z = 0.08;
      animated.push((t) => {
        molecule.rotation.y = t * 0.25;
        molecule.rotation.z = Math.sin(t * 0.2) * 0.08;
      });
    } else if (sceneType === "space" && variant === "cell") {
      floor.visible = false;
      scene.background = new THREE.Color("#101923");
      scene.fog = null;
      const cell = new THREE.Group();
      root.add(cell);
      const membrane = material("#63c5dc", 0.28);
      membrane.transparent = true;
      membrane.opacity = 0.2;
      membrane.depthWrite = false;
      mesh(cell, new THREE.SphereGeometry(1.85, 48, 36), membrane);
      mesh(
        cell,
        new THREE.SphereGeometry(0.62, 36, 28),
        material("#9477f6", 0.32),
        -0.25,
        0.15,
        0.05,
      );
      const organelleMat = material("#ed795f", 0.3);
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const organelle = mesh(
          cell,
          new THREE.SphereGeometry(0.34, 24, 18),
          organelleMat,
          Math.cos(angle) * 1.05,
          Math.sin(angle) * 0.78,
          Math.sin(angle * 1.7) * 0.7,
        );
        organelle.scale.set(1.35, 0.58, 0.72);
      }
      const ribosomeMat = material("#f3bc35", 0.25);
      for (let i = 0; i < 22; i++) {
        const angle = i * 2.4;
        const radius = 0.85 + (i % 4) * 0.18;
        mesh(
          cell,
          new THREE.SphereGeometry(0.055, 10, 8),
          ribosomeMat,
          Math.cos(angle) * radius,
          Math.sin(angle * 1.2) * 0.95,
          Math.sin(angle) * radius * 0.45,
        );
      }
      animated.push((t) => {
        cell.rotation.y = t * 0.12;
      });
    } else if (sceneType === "space" && variant === "solar") {
      floor.visible = false;
      scene.background = new THREE.Color("#07101e");
      scene.fog = null;
      const sunMaterial = material("#ffb347", 0.15);
      sunMaterial.emissive.set("#d97525");
      sunMaterial.emissiveIntensity = 0.65;
      mesh(root, new THREE.SphereGeometry(0.92, 48, 32), sunMaterial);
      const orbitRadii = [1.9, 2.85, 3.8];
      const planetColors = ["#4e95bb", "#d57e52", "#6f82ce"];
      orbitRadii.forEach((radius, i) => {
        const orbit = new THREE.Group();
        root.add(orbit);
        const ring = mesh(root, new THREE.TorusGeometry(radius, 0.018, 8, 96), material("#8aa9c0"));
        ring.rotation.x = Math.PI / 2;
        const planet = mesh(
          orbit,
          new THREE.SphereGeometry(0.24 + i * 0.07, 24, 18),
          material(planetColors[i]),
          radius,
          0,
          0,
        );
        animated.push((t) => {
          orbit.rotation.y = t * (0.24 + i * 0.1);
          orbit.rotation.z = Math.sin(t * 0.16 + i) * 0.08;
        });
      });
    } else if (sceneType === "space") {
      floor.visible = false;
      scene.background = new THREE.Color("#111c28");
      scene.fog = null;
      const globe = mesh(root, new THREE.SphereGeometry(1.8, 64, 48), material("#4c92b3"));
      for (let i = 0; i < 24; i++) {
        const a = i * 2.4,
          b = i * 0.8;
        const patch = mesh(
          globe,
          new THREE.SphereGeometry(0.23 + (i % 3) * 0.08, 12, 12),
          material("#568872"),
          Math.cos(a) * Math.sin(b) * 1.72,
          Math.cos(b) * 1.72,
          Math.sin(a) * Math.sin(b) * 1.72,
        );
        patch.scale.y = 0.7;
      }
      const orbit = new THREE.Group();
      root.add(orbit);
      box(orbit, 3, 0, 0, 0.5, 0.5, 0.5, white);
      box(orbit, 3, 0, -0.9, 0.7, 0.06, 1.2, material("#345779"));
      box(orbit, 3, 0, 0.9, 0.7, 0.06, 1.2, material("#345779"));
      animated.push((t) => {
        orbit.rotation.y = t * 0.35;
        globe.rotation.y = t * 0.08;
      });
    } else if (sceneType === "code" && variant === "graph") {
      const grid = material("#7e96a6", 0.15);
      const curveMaterial = material("#34c8e8", 0.35);
      for (let x = -3; x <= 3; x++)
        rod(root, new THREE.Vector3(x, -1.7, 0), new THREE.Vector3(x, 1.7, 0), 0.012, grid);
      for (let y = -1; y <= 1; y++)
        rod(root, new THREE.Vector3(-3.1, y, 0), new THREE.Vector3(3.1, y, 0), 0.012, grid);
      arrow(root, new THREE.Vector3(-3.2, -1.7, 0.1), new THREE.Vector3(3.2, -1.7, 0.1), white);
      arrow(root, new THREE.Vector3(-3.2, -1.7, 0.1), new THREE.Vector3(-3.2, 1.7, 0.1), white);
      const points = Array.from({ length: 65 }, (_, i) => {
        const x = -2.8 + (i / 64) * 5.6;
        return new THREE.Vector3(x, Math.sin(x * 1.35) * 0.9 + Math.cos(x * 0.6) * 0.25, 0.18);
      });
      tube(root, points, 0.055, curveMaterial);
      const marker = mesh(root, new THREE.SphereGeometry(0.14, 20, 16), yellow);
      animated.push((t) => {
        marker.position.copy(points[Math.floor(t * 8) % points.length]);
      });
    } else if (sceneType === "code" && variant === "vector") {
      const vectorGroup = new THREE.Group();
      root.add(vectorGroup);
      const origin = new THREE.Vector3(-0.8, -0.7, 0);
      arrow(vectorGroup, origin, new THREE.Vector3(2.4, -0.7, 0), material("#ef6458", 0.3));
      arrow(vectorGroup, origin, new THREE.Vector3(-0.8, 2.1, 0), material("#48d4b4", 0.3));
      arrow(vectorGroup, origin, new THREE.Vector3(1.5, 1.2, 1.8), material("#49b8ef", 0.3));
      for (let i = 0; i < 5; i++) {
        const ring = mesh(
          vectorGroup,
          new THREE.TorusGeometry(2.1 + i * 0.28, 0.012, 6, 72),
          material("#8ca0ad", 0.1),
          -0.8,
          -0.7,
          0,
        );
        ring.rotation.x = Math.PI / 2;
        ring.scale.y = 0.55;
      }
      animated.push((t) => {
        vectorGroup.rotation.y = Math.sin(t * 0.24) * 0.22;
        vectorGroup.rotation.z = Math.sin(t * 0.18) * 0.08;
      });
    } else if (
      sceneType === "code" &&
      (variant === "exam" || variant === "chalkboard" || variant === "research")
    ) {
      const paper = variant === "exam";
      const board = material(
        paper ? "#e8e4d7" : variant === "research" ? "#1c3443" : "#24453e",
        0.12,
      );
      const trim = material(paper ? "#657581" : "#b18d53", 0.55);
      box(root, 0, 0, -0.25, 5.5, 3.8, 0.2, board);
      for (const x of [-2.82, 2.82]) box(root, x, 0, -0.25, 0.14, 4.05, 0.28, trim);
      for (const y of [-1.98, 1.98]) box(root, 0, y, -0.25, 5.7, 0.14, 0.28, trim);
      const ink = material(paper ? "#34465a" : "#d8e9de", 0.08);
      if (paper) {
        for (let i = 0; i < 6; i++) {
          const y = 1.15 - i * 0.38;
          box(root, -0.75, y, -0.1, 3.1, 0.045, 0.04, ink);
          box(root, -2.15, y, -0.08, 0.16, 0.16, 0.05, trim);
        }
        const answer = box(root, -2.15, 0.01, -0.02, 0.08, 0.08, 0.08, red);
        animated.push((t) => {
          answer.position.y = 0.01 + Math.sin(t * 1.7) * 0.55;
        });
      } else if (variant === "research") {
        for (let i = 0; i < 5; i++) {
          const x = -1.8 + i * 0.85;
          const height = 0.75 + ((i * 7) % 5) * 0.28;
          box(
            root,
            x,
            -1.15 + height / 2,
            -0.08,
            0.42,
            height,
            0.08,
            i % 2 ? material("#34c8e8", 0.35) : yellow,
          );
        }
        const dataPoints = Array.from(
          { length: 7 },
          (_, i) => new THREE.Vector3(-2.35 + i * 0.78, -0.1 + Math.sin(i * 0.85) * 0.72, -0.02),
        );
        tube(root, dataPoints, 0.035, red);
      } else {
        for (let i = 0; i < 6; i++) {
          const x = -2.1 + i * 0.82;
          const y = Math.sin(i * 0.7) * 0.58;
          box(root, x, y, -0.06, 0.46, 0.05, 0.04, ink);
          box(root, x, y - 0.18, -0.06, 0.28, 0.035, 0.04, yellow);
        }
        const graphPoints = Array.from(
          { length: 9 },
          (_, i) => new THREE.Vector3(-2.2 + i * 0.55, Math.sin(i * 0.58) * 0.62 - 0.85, -0.04),
        );
        tube(root, graphPoints, 0.035, material("#55d3ee", 0.25));
      }
    } else if (sceneType === "code" && variant === "attention") {
      const tokenColors = ["#41c7e8", "#9477f6", "#f1b74a", "#50d2a0"];
      const tokens: THREE.Vector3[] = [];
      const contexts: THREE.Vector3[] = [];
      for (let i = 0; i < 4; i++) {
        const y = 1.2 - i * 0.8;
        const token = new THREE.Vector3(-2.25, y, 0.2);
        const context = new THREE.Vector3(2.2, y + (i % 2 ? 0.18 : -0.18), 0.2);
        tokens.push(token);
        contexts.push(context);
        box(root, token.x, token.y, token.z, 0.72, 0.42, 0.22, material(tokenColors[i], 0.32));
        mesh(
          root,
          new THREE.SphereGeometry(0.24, 24, 18),
          material(tokenColors[i], 0.32),
          context.x,
          context.y,
          context.z,
        );
      }
      const weights = [
        0.95, 0.42, 0.72, 0.58, 0.34, 0.88, 0.5, 0.76, 0.61, 0.38, 0.94, 0.46, 0.52, 0.7, 0.32, 0.9,
      ];
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
          const weight = weights[row * 4 + column];
          rod(
            root,
            tokens[row],
            contexts[column],
            0.012 + weight * 0.025,
            material(tokenColors[row], 0.25),
          );
        }
      }
      const signal = mesh(root, new THREE.SphereGeometry(0.11, 18, 14), white);
      animated.push((t) => {
        const index = Math.floor(t * 3) % 4;
        const progress = (t * 1.4) % 1;
        signal.position.lerpVectors(tokens[index], contexts[(index + 1) % 4], progress);
      });
    } else if (sceneType === "code" && variant === "gpu") {
      const board = material("#163b42", 0.65);
      box(root, 0, -0.95, 0, 5.7, 0.22, 4.5, board);
      const cores: THREE.Mesh[] = [];
      const coreColors = ["#43dfbc", "#4bbcef", "#b189ff", "#f3bc35"];
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 4; column++) {
          const x = (column - 1.5) * 0.9;
          const z = (row - 1.5) * 0.82;
          box(root, x, -0.25, z, 0.68, 0.14, 0.58, steel);
          const core = box(
            root,
            x,
            -0.12,
            z,
            0.48,
            0.18,
            0.38,
            material(coreColors[(row + column) % coreColors.length], 0.24),
          );
          cores.push(core);
        }
      }
      for (let i = 0; i < 4; i++) {
        const trace = rod(
          root,
          new THREE.Vector3(-2.5 + i * 0.4, -0.08, -1.7),
          new THREE.Vector3(2.5 - i * 0.35, -0.08, 1.7),
          0.025,
          yellow,
        );
        trace.material = yellow;
      }
      animated.push((t) => {
        cores.forEach((core, index) => {
          core.scale.y = 0.75 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2 + index * 0.6));
        });
      });
    } else if (sceneType === "code" && variant === "memory") {
      const memoryColors = ["#49d8b1", "#4db8eb", "#a982f7", "#e5ad4d"];
      for (let i = 0; i < 6; i++) {
        const x = -2.45 + i * 0.98;
        box(root, x, 0.15, -0.5, 0.72, 2.1, 0.34, steel);
        for (let row = 0; row < 4; row++) {
          box(
            root,
            x,
            -0.55 + row * 0.46,
            -0.28,
            0.56,
            0.28,
            0.08,
            material(memoryColors[(i + row) % memoryColors.length], 0.25),
          );
        }
      }
      const drive = box(root, 0, -1.55, 0.6, 3.2, 0.34, 1.45, material("#334a5a", 0.72));
      box(root, 0, -1.35, 0.6, 1.25, 0.05, 0.5, yellow);
      const packet = mesh(root, new THREE.SphereGeometry(0.14, 18, 14), red);
      animated.push((t) => {
        const step = (t * 1.4) % 6;
        packet.position.set(-2.45 + step * 0.98, 0.55 + Math.sin(t * 4) * 0.08, 0.35);
        drive.rotation.y = Math.sin(t * 0.4) * 0.025;
      });
    } else if (sceneType === "code" && variant === "hash-table") {
      const bucketMat = material("#355466", 0.65);
      const nodeMat = material("#53d6b0", 0.28);
      for (let i = 0; i < 5; i++) {
        const y = 1.15 - i * 0.58;
        box(root, -1.7, y, 0, 0.8, 0.42, 0.36, bucketMat);
        box(root, -1.7, y, 0.22, 0.3, 0.13, 0.08, yellow);
        const count = i === 2 ? 3 : i === 4 ? 2 : 1;
        for (let j = 0; j < count; j++) {
          const x = -0.35 + j * 1.05;
          mesh(root, new THREE.SphereGeometry(0.22, 20, 16), nodeMat, x, y, 0.12);
          rod(
            root,
            new THREE.Vector3(-1.28 + j * 1.05, y, 0.1),
            new THREE.Vector3(x - 0.23, y, 0.1),
            0.035,
            steel,
          );
        }
      }
      const probe = mesh(root, new THREE.SphereGeometry(0.14, 18, 14), red);
      animated.push((t) => {
        const row = Math.floor(t * 1.2) % 5;
        probe.position.set(-0.82, 1.15 - row * 0.58, 0.4);
      });
    } else if (sceneType === "code" && variant === "neural") {
      const layerRows = [3, 5, 3];
      const layerPositions = layerRows.map((count, layer) =>
        Array.from(
          { length: count },
          (_, index) => new THREE.Vector3((layer - 1) * 2.4, (index - (count - 1) / 2) * 1.15, 0),
        ),
      );
      const synapse = material("#4cc9ff", 0.35);
      for (let layer = 0; layer < layerPositions.length - 1; layer++) {
        layerPositions[layer].forEach((from, fromIndex) => {
          layerPositions[layer + 1].forEach((to, toIndex) => {
            if (
              (fromIndex + toIndex) % 2 === 0 ||
              toIndex === fromIndex % layerPositions[layer + 1].length
            )
              rod(root, from, to, 0.025, synapse);
          });
        });
      }
      const layerColors = ["#3dfc9a", "#38bdf8", "#a78bfa"];
      layerPositions.forEach((positions, layer) => {
        const nodeMaterial = material(layerColors[layer], 0.2);
        positions.forEach((point, index) => {
          const neuron = mesh(
            root,
            new THREE.IcosahedronGeometry(0.22, 2),
            nodeMaterial,
            point.x,
            point.y,
            point.z,
          );
          animated.push((t) => {
            neuron.scale.setScalar(0.82 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2.4 + index + layer)));
          });
        });
      });
    } else {
      const screen = box(root, 0, 0, 0, 5, 3.2, 0.24, steel);
      const display = material("#213c46");
      box(root, 0, 0, 0.14, 4.65, 2.85, 0.03, display);
      for (let i = 0; i < 9; i++)
        box(
          root,
          -0.4 + (i % 3) * 0.3,
          1.1 - i * 0.27,
          0.18,
          1.7 + (i % 3) * 0.45,
          0.07,
          0.02,
          i % 3 === 0 ? yellow : material("#8bd6c2"),
        );
      box(root, 0, -1.8, 0, 0.35, 0.7, 0.3, steel);
      box(root, 0, -2.1, 0, 2, 0.12, 1, steel);
      animated.push((t) => {
        screen.rotation.y = Math.sin(t * 0.3) * 0.04;
      });
    }
    if (sceneType === "code" && variant !== "terminal") root.scale.setScalar(0.82);
    if (sceneType === "network" && (variant === "economy" || variant === "timeline"))
      root.scale.setScalar(0.86);
    groupMaterials.set(root, ownedMaterials);
    buildingMaterials = null;
    return root;
  }
  return {
    draw(
      ctx: CanvasRenderingContext2D,
      preset: ScenePreset,
      text: string,
      t: number,
      shot: number,
      subcategory?: string,
    ) {
      const key = /공사|말뚝|건축|콘크리트|드릴|지반/.test(text)
        ? "construction"
        : `${preset}:${sceneVariantFor(preset, text, shot, subcategory)}`;
      const [sceneType, variant] = key.split(":");
      if (active !== key) {
        animated.length = 0;
        for (const group of groups.values()) group.visible = false;
        // Rebuild when revisiting a scene so its animation bindings are local.
        const old = groups.get(key);
        if (old) {
          scene.remove(old);
          old.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
          });
          groupMaterials.get(old)?.forEach((ownedMaterial) => ownedMaterial.dispose());
          groupMaterials.delete(old);
          groups.delete(key);
        }
        floor.visible = true;
        scene.background = new THREE.Color("#c9d4dc");
        scene.fog = new THREE.Fog("#c9d4dc", 24, 55);
        build(key);
        active = key;
      }
      for (const update of animated) update(t);
      const composition = SHOT_COMPOSITIONS[sceneShotIndex(text, shot, SHOT_COMPOSITIONS.length)];
      const angle = composition.yaw + Math.sin(t * 0.14) * 0.1;
      const baseDistance =
        sceneType === "construction"
          ? 14
          : sceneType === "robot" && variant === "gearbox"
            ? 16
            : sceneType === "code"
              ? 17
              : sceneType === "space" && (variant === "wave" || variant === "molecule")
                ? 15
                : 12;
      const distance = baseDistance * composition.distance;
      const root = groups.get(key);
      if (root) root.rotation.y = composition.modelYaw + Math.sin(t * 0.12) * 0.045;
      if (camera.fov !== composition.fov) {
        camera.fov = composition.fov;
        camera.updateProjectionMatrix();
      }
      camera.position.set(
        Math.sin(angle) * distance,
        composition.height + Math.sin(t * 0.4) * 0.18,
        Math.cos(angle) * distance,
      );
      camera.lookAt(0, composition.targetY + (sceneType === "construction" ? 0.7 : -0.2), 0);
      renderer.render(scene, camera);
      ctx.drawImage(renderer.domElement, 0, 0, 720, 1280);
    },
    dispose() {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      groupMaterials.clear();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
export type SolidScenes = ReturnType<typeof createSolidScenes>;
