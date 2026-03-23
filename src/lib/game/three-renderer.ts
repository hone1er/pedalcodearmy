import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { RenderState, MopedMake, GameEntity } from "./types";
import {
  PLAYER_X_POSITION,
} from "./types";

// ── QUALITY TIERS ─────────────────────────────────────────────────────────

type QualityTier = "low" | "medium" | "high";

interface QualitySettings {
  pixelRatioCap: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  bloomEnabled: boolean;
  bloomResScale: number;
  maxExhaust: number;
  maxSparkles: number;
  maxSpeedLines: number;
  buildingCount: number;
  cloudCount: number;
  collectibleLights: boolean;
  geoDetail: number;      // multiplier for segment counts (0.5 = half)
  antialias: boolean;
}

const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    pixelRatioCap: 1,
    shadowMapSize: 0,
    shadowsEnabled: false,
    bloomEnabled: false,
    bloomResScale: 0,
    maxExhaust: 40,
    maxSparkles: 20,
    maxSpeedLines: 15,
    buildingCount: 25,
    cloudCount: 5,
    collectibleLights: false,
    geoDetail: 0.5,
    antialias: false,
  },
  medium: {
    pixelRatioCap: 1.5,
    shadowMapSize: 512,
    shadowsEnabled: true,
    bloomEnabled: true,
    bloomResScale: 0.5,
    maxExhaust: 80,
    maxSparkles: 50,
    maxSpeedLines: 30,
    buildingCount: 40,
    cloudCount: 8,
    collectibleLights: false,
    geoDetail: 0.75,
    antialias: true,
  },
  high: {
    pixelRatioCap: 2,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    bloomEnabled: true,
    bloomResScale: 1,
    maxExhaust: 150,
    maxSparkles: 80,
    maxSpeedLines: 50,
    buildingCount: 60,
    cloudCount: 12,
    collectibleLights: false,
    geoDetail: 1,
    antialias: true,
  },
};

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const WORLD_SCALE = 1 / 30;
const ROAD_Z_MIN = -3;
const ROAD_Z_MAX = 3;
const ROAD_WIDTH = 30;
const LANE_POSITIONS = [-1.5, 0, 1.5];

const MOPED_COLORS: Record<
  MopedMake,
  { frame: number; accent: number; seat: number; fender: number }
> = {
  "puch-maxi": { frame: 0xffffff, accent: 0x22c55e, seat: 0x1f2937, fender: 0xe5e7eb },
  "honda-hobbit": { frame: 0xef4444, accent: 0xffffff, seat: 0x1f2937, fender: 0xdc2626 },
  "derbi-variant": { frame: 0x3b82f6, accent: 0xeab308, seat: 0x1f2937, fender: 0x2563eb },
  "tomos-a35": { frame: 0x374151, accent: 0xc0c0c0, seat: 0x111827, fender: 0x4b5563 },
};

const CAR_PALETTES = [
  { body: 0xdc2626, roof: 0xb91c1c, trim: 0x991b1b },
  { body: 0x2563eb, roof: 0x1d4ed8, trim: 0x1e40af },
  { body: 0xf5f5f5, roof: 0xe5e5e5, trim: 0xd4d4d4 },
  { body: 0x6b7280, roof: 0x4b5563, trim: 0x374151 },
  { body: 0x16a34a, roof: 0x15803d, trim: 0x166534 },
  { body: 0xf59e0b, roof: 0xd97706, trim: 0xb45309 },
  { body: 0x7c3aed, roof: 0x6d28d9, trim: 0x5b21b6 },
  { body: 0x1f2937, roof: 0x111827, trim: 0x030712 },
];

const SHOP_BRANDS: Record<
  string,
  { bg: number; trim: number; awning: number; text: string }
> = {
  treatland: { bg: 0x166534, trim: 0x22c55e, awning: 0x15803d, text: "TREATLAND" },
  "1977-mopeds": { bg: 0x1e40af, trim: 0x60a5fa, awning: 0x1d4ed8, text: "1977" },
  "myrons-mopeds": { bg: 0x9a3412, trim: 0xfb923c, awning: 0xc2410c, text: "MYRON'S" },
};

// ── PARTICLE DATA ──────────────────────────────────────────────────────────

interface Particle3D {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number; size: number;
}

interface Sparkle3D {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  color: number;
}

interface SpeedLine3D {
  x: number; z: number; length: number; speed: number;
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function laneToZ(lane: number): number {
  return LANE_POSITIONS[lane] ?? 0;
}

function entityToWorldX(entityX: number, canvasWidth: number): number {
  const playerScreenX = canvasWidth * PLAYER_X_POSITION;
  return (entityX - playerScreenX) * WORLD_SCALE;
}

function disposeMeshObj(obj: THREE.Object3D): void {
  if (!("geometry" in obj)) return;
  const mesh = obj as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
  mesh.geometry.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) {
    for (const m of mat) {
      m.dispose();
    }
  } else {
    mat.dispose();
  }
}

/** Segment count scaled by quality detail level */
function seg(base: number, detail: number): number {
  return Math.max(3, Math.round(base * detail));
}

/** Detect GPU tier by running a quick benchmark draw */
function detectTier(renderer: THREE.WebGLRenderer): QualityTier {
  // Check for mobile / low-end signals first
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  if (debugInfo) {
    const gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
    const lower = gpuRenderer.toLowerCase();
    // Known low-end / integrated GPUs
    if (
      lower.includes("mali") ||
      lower.includes("adreno 3") ||
      lower.includes("adreno 4") ||
      lower.includes("powervr") ||
      lower.includes("intel hd") ||
      lower.includes("intel uhd") ||
      lower.includes("swiftshader") ||
      lower.includes("llvmpipe")
    ) {
      return "low";
    }
    // Mid-range mobile
    if (
      lower.includes("adreno 5") ||
      lower.includes("adreno 6") ||
      lower.includes("apple gpu") ||
      lower.includes("intel iris")
    ) {
      return "medium";
    }
  }

  // Mobile UA heuristic
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return "low";
  }

  // Small screens likely mobile or low-end
  if (window.innerWidth < 800) {
    return "medium";
  }

  return "high";
}

const _tmpMatrix = new THREE.Matrix4();
const _tmpColor = new THREE.Color();
const _tmpVec = new THREE.Vector3();

// ── SHARED GEOMETRY & MATERIAL CACHES ─────────────────────────────────────
// Created once on first use, reused for every entity of that type.

let _sharedGeoCache: Map<string, THREE.BufferGeometry> | null = null;
let _sharedMatCache: Map<string, THREE.Material> | null = null;

function getGeoCache(): Map<string, THREE.BufferGeometry> {
  _sharedGeoCache ??= new Map();
  return _sharedGeoCache;
}
function getMatCache(): Map<string, THREE.Material> {
  _sharedMatCache ??= new Map();
  return _sharedMatCache;
}

function cachedGeo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const cache = getGeoCache();
  let g = cache.get(key);
  if (!g) {
    g = factory();
    cache.set(key, g);
  }
  return g;
}

function cachedMat(key: string, factory: () => THREE.Material): THREE.Material {
  const cache = getMatCache();
  let m = cache.get(key);
  if (!m) {
    m = factory();
    cache.set(key, m);
  }
  return m;
}

// ── THREE RENDERER CLASS ──────────────────────────────────────────────────

export class ThreeRenderer {
  private webglRenderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private composer!: EffectComposer | null;
  private bloomPass!: UnrealBloomPass | null;
  private initialized = false;
  private parentEl: HTMLElement;
  private frameCount = 0;
  private tier: QualityTier = "high";
  private q!: QualitySettings;

  // Groups
  private skyGroup!: THREE.Group;
  private bgGroup!: THREE.Group;
  private roadGroup!: THREE.Group;
  private entityGroup!: THREE.Group;
  private mopedGroup!: THREE.Group;
  private particleGroup!: THREE.Group;

  // Lights
  private dirLight!: THREE.DirectionalLight | null;
  private ambientLight!: THREE.AmbientLight;

  // Sky
  private skyPlane!: THREE.Mesh;
  private sunMesh!: THREE.Mesh;
  private sunLight!: THREE.PointLight;
  private cloudInstanced!: THREE.InstancedMesh;
  private cloudData: { x: number; y: number; z: number; w: number; h: number; speed: number }[] = [];

  // Background
  private hillMesh!: THREE.Mesh;
  private buildingInstanced!: THREE.InstancedMesh;
  private lastBuildingScroll = -1;

  // Road
  private roadPlane!: THREE.Mesh;
  private sidewalkTop!: THREE.Mesh;
  private sidewalkBottom!: THREE.Mesh;
  private curbTop!: THREE.Mesh;
  private curbBottom!: THREE.Mesh;
  private laneDashInstanced!: THREE.InstancedMesh;
  private laneDashCount = 40;

  // Entities pool
  private entityMeshes = new Map<number, THREE.Group>();
  private entityPool: THREE.Group[] = []; // reusable groups

  // Moped parts
  private mopedParts!: {
    rearWheel: THREE.Mesh;
    frontWheel: THREE.Mesh;
    frame: THREE.Group;
    engine: THREE.Mesh;
    seat: THREE.Mesh;
    rider: THREE.Group;
    headlightMesh: THREE.Mesh;
    exhaust: THREE.Mesh;
  };
  private currentMake: MopedMake = "puch-maxi";

  // Particles
  private particles: Particle3D[] = [];
  private sparkles: Sparkle3D[] = [];
  private speedLines: SpeedLine3D[] = [];
  private exhaustInstanced!: THREE.InstancedMesh;
  private sparkleInstanced!: THREE.InstancedMesh;
  private speedLineInstanced!: THREE.InstancedMesh;

  // Hit flash
  private hitFlashPlane!: THREE.Mesh;

  // Camera shake
  private shakeOffset = { x: 0, y: 0 };
  private baseCameraPos = new THREE.Vector3();

  constructor(parentEl: HTMLElement) {
    this.parentEl = parentEl;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const rect = this.parentEl.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    // Create renderer first to detect GPU tier
    this.webglRenderer = new THREE.WebGLRenderer({
      antialias: false, // will set after tier detection
      alpha: false,
      powerPreference: "high-performance",
    });

    this.tier = detectTier(this.webglRenderer);
    this.q = QUALITY[this.tier];

    // Re-create with correct antialias if needed (cheap at init time)
    if (this.q.antialias) {
      this.webglRenderer.dispose();
      this.webglRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    }

    this.webglRenderer.setSize(w, h);
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, this.q.pixelRatioCap));

    if (this.q.shadowsEnabled) {
      this.webglRenderer.shadowMap.enabled = true;
      this.webglRenderer.shadowMap.type = THREE.PCFShadowMap; // cheaper than PCFSoft
    } else {
      this.webglRenderer.shadowMap.enabled = false;
    }

    this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.webglRenderer.toneMappingExposure = 1.1;
    this.parentEl.appendChild(this.webglRenderer.domElement);
    this.webglRenderer.domElement.style.width = "100%";
    this.webglRenderer.domElement.style.height = "100%";

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera — ortho angled 2.5D
    const aspect = w / h;
    const frustum = 8;
    this.camera = new THREE.OrthographicCamera(
      -frustum * aspect, frustum * aspect,
      frustum, -frustum,
      0.1, 200,
    );
    this.camera.position.set(6, 10, 10);
    this.camera.lookAt(0, 0, 0);
    this.baseCameraPos.copy(this.camera.position);

    // Post-processing (only if bloom enabled)
    if (this.q.bloomEnabled) {
      this.composer = new EffectComposer(this.webglRenderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloomW = Math.round(w * this.q.bloomResScale);
      const bloomH = Math.round(h * this.q.bloomResScale);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(bloomW, bloomH), 0.6, 0.4, 0.85,
      );
      this.composer.addPass(this.bloomPass);
    } else {
      this.composer = null;
      this.bloomPass = null;
    }

    // Groups
    this.skyGroup = new THREE.Group();
    this.bgGroup = new THREE.Group();
    this.roadGroup = new THREE.Group();
    this.entityGroup = new THREE.Group();
    this.mopedGroup = new THREE.Group();
    this.particleGroup = new THREE.Group();
    this.scene.add(this.skyGroup, this.bgGroup, this.roadGroup, this.entityGroup, this.mopedGroup, this.particleGroup);

    // Lights
    this.setupLights();

    // Build scene elements
    this.buildSky();
    this.buildBackground();
    this.buildRoad();
    this.buildMoped("puch-maxi");
    this.buildParticles();
    this.buildHitFlash();

    this.initialized = true;
  }

  // ── LIGHTS ──────────────────────────────────────────────────────────────

  private setupLights(): void {
    this.ambientLight = new THREE.AmbientLight(0xffeedd, this.q.shadowsEnabled ? 0.5 : 0.8);
    this.scene.add(this.ambientLight);

    if (this.q.shadowsEnabled) {
      this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
      this.dirLight.position.set(10, 15, 5);
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(this.q.shadowMapSize, this.q.shadowMapSize);
      this.dirLight.shadow.camera.left = -15;
      this.dirLight.shadow.camera.right = 15;
      this.dirLight.shadow.camera.top = 8;
      this.dirLight.shadow.camera.bottom = -8;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 35;
      this.dirLight.shadow.bias = -0.002;
      this.scene.add(this.dirLight);
      this.scene.add(this.dirLight.target);
    } else {
      // Use a non-shadow directional for basic lighting
      this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
      this.dirLight.position.set(10, 15, 5);
      this.dirLight.castShadow = false;
      this.scene.add(this.dirLight);
    }
  }

  // ── SKY ─────────────────────────────────────────────────────────────────

  private buildSky(): void {
    const d = this.q.geoDetail;

    // Sky gradient plane
    const skyGeo = new THREE.PlaneGeometry(80, 40);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(0x4a90d9) },
        uBottomColor: { value: new THREE.Color(0xf4a460) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        varying vec2 vUv;
        void main() {
          gl_FragColor = vec4(mix(uBottomColor, uTopColor, vUv.y), 1.0);
        }
      `,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.skyPlane = new THREE.Mesh(skyGeo, skyMat);
    this.skyPlane.position.set(0, 8, -25);
    this.skyPlane.renderOrder = -1;
    this.skyGroup.add(this.skyPlane);

    // Sun
    const sunGeo = new THREE.SphereGeometry(1.2, seg(12, d), seg(12, d));
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(12, 12, -20);
    this.skyGroup.add(this.sunMesh);

    this.sunLight = new THREE.PointLight(0xffdc64, 0.5, 50);
    this.sunLight.position.copy(this.sunMesh.position);
    this.skyGroup.add(this.sunLight);

    // Clouds (instanced boxes — use Lambert for cheap shading)
    const cloudGeo = new THREE.BoxGeometry(2, 0.5, 1);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
    });
    this.cloudInstanced = new THREE.InstancedMesh(cloudGeo, cloudMat, this.q.cloudCount);
    this.cloudInstanced.castShadow = false;
    this.cloudInstanced.receiveShadow = false;
    this.skyGroup.add(this.cloudInstanced);

    this.cloudData = [];
    for (let i = 0; i < this.q.cloudCount; i++) {
      const data = {
        x: (Math.random() - 0.5) * 40,
        y: 6 + Math.random() * 6,
        z: -18 - Math.random() * 8,
        w: 1.5 + Math.random() * 2,
        h: 0.3 + Math.random() * 0.3,
        speed: 0.3 + Math.random() * 0.5,
      };
      this.cloudData.push(data);
      _tmpMatrix.makeScale(data.w, data.h, data.w * 0.6);
      _tmpMatrix.setPosition(data.x, data.y, data.z);
      this.cloudInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.cloudInstanced.instanceMatrix.needsUpdate = true;
  }

  // ── BACKGROUND ──────────────────────────────────────────────────────────

  private buildBackground(): void {
    // Hills — Lambert is fine for background
    const hillShape = new THREE.Shape();
    hillShape.moveTo(-20, 0);
    for (let x = -20; x <= 20; x += 1) { // coarser step
      const y = Math.sin(x * 0.3) * 1.5 + Math.sin(x * 0.15) * 2 + 2;
      hillShape.lineTo(x, y);
    }
    hillShape.lineTo(20, 0);
    hillShape.closePath();

    const hillGeo = new THREE.ExtrudeGeometry(hillShape, { depth: 3, bevelEnabled: false });
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x3d2b5e });
    this.hillMesh = new THREE.Mesh(hillGeo, hillMat);
    this.hillMesh.rotation.x = -Math.PI / 2;
    this.hillMesh.position.set(0, 0, -12);
    this.bgGroup.add(this.hillMesh);

    // Buildings (instanced boxes — Lambert)
    const bc = this.q.buildingCount;
    const buildGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildMat = new THREE.MeshLambertMaterial({
      color: 0x1a1a2e,
      emissive: 0x111122,
      emissiveIntensity: 0.2,
    });
    this.buildingInstanced = new THREE.InstancedMesh(buildGeo, buildMat, bc);
    this.buildingInstanced.castShadow = this.q.shadowsEnabled;
    this.buildingInstanced.receiveShadow = false;
    this.bgGroup.add(this.buildingInstanced);

    for (let i = 0; i < bc; i++) {
      const bx = -15 + i * (30 / bc);
      const bh = 1 + Math.abs(Math.sin(i * 2.5)) * 3 + Math.abs(Math.cos(i * 1.3)) * 2;
      const bw = 0.6;
      const bz = -8 - (i % 3) * 0.5;
      _tmpMatrix.makeScale(bw, bh, bw);
      _tmpVec.set(bx, bh / 2, bz);
      _tmpMatrix.setPosition(_tmpVec);
      this.buildingInstanced.setMatrixAt(i, _tmpMatrix);

      const windowLit = Math.sin(i * 127.1) * 43758.5453;
      const litFrac = windowLit - Math.floor(windowLit);
      this.buildingInstanced.setColorAt(i, _tmpColor.setHex(litFrac > 0.5 ? 0x2a2a4e : 0x1a1a2e));
    }
    this.buildingInstanced.instanceMatrix.needsUpdate = true;
    if (this.buildingInstanced.instanceColor) {
      this.buildingInstanced.instanceColor.needsUpdate = true;
    }
  }

  // ── ROAD ────────────────────────────────────────────────────────────────

  private buildRoad(): void {
    // Road surface — Lambert
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_Z_MAX - ROAD_Z_MIN);
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    this.roadPlane = new THREE.Mesh(roadGeo, roadMat);
    this.roadPlane.rotation.x = -Math.PI / 2;
    this.roadPlane.position.set(0, 0, 0);
    this.roadPlane.receiveShadow = this.q.shadowsEnabled;
    this.roadGroup.add(this.roadPlane);

    // Sidewalks — Lambert
    const swGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.15, 0.8);
    const swMat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a });
    this.sidewalkTop = new THREE.Mesh(swGeo, swMat);
    this.sidewalkTop.position.set(0, 0.075, ROAD_Z_MIN - 0.5);
    this.sidewalkTop.receiveShadow = this.q.shadowsEnabled;
    this.roadGroup.add(this.sidewalkTop);

    this.sidewalkBottom = new THREE.Mesh(swGeo, swMat);
    this.sidewalkBottom.position.set(0, 0.075, ROAD_Z_MAX + 0.5);
    this.sidewalkBottom.receiveShadow = this.q.shadowsEnabled;
    this.roadGroup.add(this.sidewalkBottom);

    // Curbs — Lambert
    const curbGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.1, 0.12);
    const curbMat = new THREE.MeshLambertMaterial({ color: 0xffd700 });
    this.curbTop = new THREE.Mesh(curbGeo, curbMat);
    this.curbTop.position.set(0, 0.05, ROAD_Z_MIN - 0.06);
    this.roadGroup.add(this.curbTop);

    this.curbBottom = new THREE.Mesh(curbGeo, curbMat);
    this.curbBottom.position.set(0, 0.05, ROAD_Z_MAX + 0.06);
    this.roadGroup.add(this.curbBottom);

    // Lane dashes (instanced — Lambert)
    const dashGeo = new THREE.BoxGeometry(0.8, 0.02, 0.06);
    const dashMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    this.laneDashInstanced = new THREE.InstancedMesh(dashGeo, dashMat, this.laneDashCount);
    this.roadGroup.add(this.laneDashInstanced);

    for (let i = 0; i < this.laneDashCount; i++) {
      _tmpMatrix.identity();
      _tmpMatrix.setPosition(0, -10, 0);
      this.laneDashInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.laneDashInstanced.instanceMatrix.needsUpdate = true;
  }

  // ── MOPED ───────────────────────────────────────────────────────────────

  private buildMoped(make: MopedMake): void {
    this.currentMake = make;
    while (this.mopedGroup.children.length > 0) {
      const child = this.mopedGroup.children[0]!;
      this.mopedGroup.remove(child);
    }

    const colors = MOPED_COLORS[make];
    const wheelRadius = 0.35;
    const d = this.q.geoDetail;

    // Wheels (torus) — Standard for metallic sheen on hero object
    const wheelGeo = new THREE.TorusGeometry(wheelRadius, 0.08, seg(6, d), seg(12, d));
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1f2937, roughness: 0.6, metalness: 0.3,
    });

    const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rearWheel.position.set(-0.6, wheelRadius, 0);
    rearWheel.castShadow = this.q.shadowsEnabled;
    this.mopedGroup.add(rearWheel);

    const frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    frontWheel.position.set(0.6, wheelRadius, 0);
    frontWheel.castShadow = this.q.shadowsEnabled;
    this.mopedGroup.add(frontWheel);

    // Frame tubes — Standard (metallic hero material)
    const frameGroup = new THREE.Group();
    const tubeMat = new THREE.MeshStandardMaterial({
      color: colors.frame, roughness: 0.2, metalness: 0.8,
    });

    const mainTubeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.4, seg(6, d));
    const mainTube = new THREE.Mesh(mainTubeGeo, tubeMat);
    mainTube.rotation.z = Math.PI / 2 + 0.15;
    mainTube.position.set(0, wheelRadius + 0.25, 0);
    mainTube.castShadow = this.q.shadowsEnabled;
    frameGroup.add(mainTube);

    const seatTubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.6, seg(6, d));
    const seatTube = new THREE.Mesh(seatTubeGeo, tubeMat);
    seatTube.position.set(-0.3, wheelRadius + 0.5, 0);
    frameGroup.add(seatTube);

    const headTubeGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.6, seg(6, d));
    const headTube = new THREE.Mesh(headTubeGeo, tubeMat);
    headTube.rotation.z = 0.2;
    headTube.position.set(0.5, wheelRadius + 0.5, 0);
    frameGroup.add(headTube);
    this.mopedGroup.add(frameGroup);

    // Engine block
    const engineGeo = new THREE.BoxGeometry(0.35, 0.25, 0.2);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x4b5563, roughness: 0.5, metalness: 0.4,
    });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.set(-0.15, wheelRadius + 0.05, 0);
    engine.castShadow = this.q.shadowsEnabled;
    this.mopedGroup.add(engine);

    // Seat — Lambert (non-reflective)
    const seatGeo = new THREE.BoxGeometry(0.5, 0.08, 0.22);
    const seatMat = new THREE.MeshLambertMaterial({ color: colors.seat });
    const seat = new THREE.Mesh(seatGeo, seatMat);
    seat.position.set(-0.25, wheelRadius + 0.82, 0);
    this.mopedGroup.add(seat);

    // Rider — Lambert
    const riderGroup = new THREE.Group();
    const torsoGeo = new THREE.BoxGeometry(0.25, 0.45, 0.2);
    const torsoMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.set(-0.15, wheelRadius + 1.1, 0);
    riderGroup.add(torso);

    const helmetGeo = new THREE.SphereGeometry(0.16, seg(8, d), seg(8, d));
    const helmetMat = new THREE.MeshStandardMaterial({
      color: colors.accent, roughness: 0.3, metalness: 0.5,
    });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(-0.1, wheelRadius + 1.45, 0);
    riderGroup.add(helmet);

    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, seg(5, d));
    const armMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.rotation.z = Math.PI / 2 + 0.3;
    arm.position.set(0.15, wheelRadius + 1.05, 0);
    riderGroup.add(arm);

    const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.4, seg(5, d));
    const legMat = new THREE.MeshLambertMaterial({ color: 0x374151 });
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.rotation.z = 0.5;
    leg.position.set(-0.3, wheelRadius + 0.65, 0);
    riderGroup.add(leg);
    this.mopedGroup.add(riderGroup);

    // Headlight — emissive mesh only, no SpotLight
    const hlGeo = new THREE.SphereGeometry(0.08, seg(6, d), seg(6, d));
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a, emissive: 0xfde68a, emissiveIntensity: 2,
      roughness: 0.3, metalness: 0,
    });
    const headlightMesh = new THREE.Mesh(hlGeo, hlMat);
    headlightMesh.position.set(0.65, wheelRadius + 0.45, 0);
    this.mopedGroup.add(headlightMesh);

    // Exhaust pipe — Standard (metallic)
    const exhaustGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.4, seg(6, d));
    const exhaustMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af, roughness: 0.3, metalness: 0.7,
    });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.rotation.z = Math.PI / 2;
    exhaust.position.set(-0.8, wheelRadius + 0.1, 0);
    this.mopedGroup.add(exhaust);

    // Taillight — emissive
    const tlGeo = new THREE.SphereGeometry(0.05, seg(6, d), seg(6, d));
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5,
    });
    const taillight = new THREE.Mesh(tlGeo, tlMat);
    taillight.position.set(-0.7, wheelRadius + 0.3, 0);
    this.mopedGroup.add(taillight);

    this.mopedParts = {
      rearWheel, frontWheel, frame: frameGroup, engine, seat,
      rider: riderGroup, headlightMesh, exhaust,
    };

    if (this.q.shadowsEnabled) {
      this.mopedGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
        }
      });
    }
  }

  // ── PARTICLES ───────────────────────────────────────────────────────────

  private buildParticles(): void {
    const d = this.q.geoDetail;

    // Exhaust — Lambert (no reflections needed on smoke)
    const sphereGeo = new THREE.SphereGeometry(0.05, seg(4, d), seg(4, d));
    const exhaustMat = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa, transparent: true, opacity: 0.5,
    });
    this.exhaustInstanced = new THREE.InstancedMesh(sphereGeo, exhaustMat, this.q.maxExhaust);
    this.exhaustInstanced.castShadow = false;
    this.exhaustInstanced.frustumCulled = false;
    this.particleGroup.add(this.exhaustInstanced);
    this.hideAllInstances(this.exhaustInstanced, this.q.maxExhaust);

    // Sparkles — Basic with emissive-like color (bloom picks up MeshBasicMaterial too)
    const starGeo = new THREE.OctahedronGeometry(0.06, 0);
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0.9,
    });
    this.sparkleInstanced = new THREE.InstancedMesh(starGeo, sparkleMat, this.q.maxSparkles);
    this.sparkleInstanced.castShadow = false;
    this.sparkleInstanced.frustumCulled = false;
    this.particleGroup.add(this.sparkleInstanced);
    this.hideAllInstances(this.sparkleInstanced, this.q.maxSparkles);

    // Speed lines — Basic
    const lineGeo = new THREE.BoxGeometry(1, 0.01, 0.01);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.25,
    });
    this.speedLineInstanced = new THREE.InstancedMesh(lineGeo, lineMat, this.q.maxSpeedLines);
    this.speedLineInstanced.castShadow = false;
    this.speedLineInstanced.frustumCulled = false;
    this.particleGroup.add(this.speedLineInstanced);
    this.hideAllInstances(this.speedLineInstanced, this.q.maxSpeedLines);
  }

  private hideAllInstances(mesh: THREE.InstancedMesh, count: number): void {
    _tmpMatrix.makeScale(0, 0, 0);
    _tmpMatrix.setPosition(0, -100, 0);
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, _tmpMatrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ── HIT FLASH ───────────────────────────────────────────────────────────

  private buildHitFlash(): void {
    const geo = new THREE.PlaneGeometry(100, 100);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000, transparent: true, opacity: 0,
      depthTest: false, depthWrite: false,
    });
    this.hitFlashPlane = new THREE.Mesh(geo, mat);
    this.hitFlashPlane.renderOrder = 999;
    this.hitFlashPlane.position.copy(this.camera.position);
    this.hitFlashPlane.quaternion.copy(this.camera.quaternion);
    this.hitFlashPlane.translateZ(-1);
    this.scene.add(this.hitFlashPlane);
  }

  // ── PUBLIC API ──────────────────────────────────────────────────────────

  resize(w: number, h: number): void {
    if (!this.initialized) return;
    this.webglRenderer.setSize(w, h);
    if (this.composer) this.composer.setSize(w, h);

    const aspect = w / h;
    const frustum = 8;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();

    if (this.bloomPass) {
      const bw = Math.round(w * this.q.bloomResScale);
      const bh = Math.round(h * this.q.bloomResScale);
      this.bloomPass.resolution.set(bw, bh);
    }
  }

  render(state: RenderState, dt: number): void {
    if (!this.initialized) return;
    this.frameCount++;

    const w = state.canvasWidth;

    // Rebuild moped if make changed
    if (this.currentMake !== state.moped) {
      this.buildMoped(state.moped);
    }

    // Camera shake
    this.updateShake(state);
    this.camera.position.set(
      this.baseCameraPos.x + this.shakeOffset.x * 0.02,
      this.baseCameraPos.y + this.shakeOffset.y * 0.02,
      this.baseCameraPos.z,
    );

    // Update scene elements
    this.updateClouds(dt);
    this.updateBuildings(state);
    this.updateRoad(state);
    this.updateEntities(state, w);
    this.updateMoped(state);
    this.updateParticles(state, dt);
    this.updateSparkles(dt);
    this.updateSpeedLines(state, dt);
    this.updateHitFlash(state);

    if (this.bloomPass) {
      this.updateBloom(state);
    }

    // Render
    if (this.composer) {
      this.composer.render(dt);
    } else {
      this.webglRenderer.render(this.scene, this.camera);
    }
  }

  reset(): void {
    this.particles = [];
    this.sparkles = [];
    this.speedLines = [];
    this.shakeOffset = { x: 0, y: 0 };
    this.frameCount = 0;
    this.lastBuildingScroll = -1;

    // Return entity meshes to pool
    for (const [, group] of this.entityMeshes) {
      this.entityGroup.remove(group);
      this.recycleEntityGroup(group);
    }
    this.entityMeshes.clear();

    // Reset particle instances
    this.hideAllInstances(this.exhaustInstanced, this.q.maxExhaust);
    this.hideAllInstances(this.sparkleInstanced, this.q.maxSparkles);
    this.hideAllInstances(this.speedLineInstanced, this.q.maxSpeedLines);

    for (const data of this.cloudData) {
      data.x = (Math.random() - 0.5) * 40;
    }
  }

  destroy(): void {
    if (!this.initialized) return;

    this.reset();
    if (this.composer) this.composer.dispose();
    this.webglRenderer.dispose();
    this.scene.traverse((obj) => {
      disposeMeshObj(obj);
    });

    // Dispose pooled groups
    for (const group of this.entityPool) {
      group.traverse((obj) => { disposeMeshObj(obj); });
    }
    this.entityPool = [];

    if (this.webglRenderer.domElement.parentElement) {
      this.webglRenderer.domElement.parentElement.removeChild(this.webglRenderer.domElement);
    }
    this.initialized = false;
  }

  spawnCollectSparkles(_x: number, _y: number): void {
    const worldX = 0;
    const worldY = 0.5;

    const count = Math.min(12, this.q.maxSparkles - this.sparkles.length);
    for (let i = 0; i < count; i++) {
      const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this.sparkles.push({
        x: worldX + (Math.random() - 0.5) * 0.5,
        y: worldY + Math.random() * 0.5,
        z: (Math.random() - 0.5) * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.abs(Math.sin(angle)) * speed + 2,
        vz: (Math.random() - 0.5) * speed,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        color: Math.random() > 0.5 ? 0xffd700 : 0xffff96,
      });
    }
  }

  spawnHitSparks(_x: number, _y: number): void {
    const count = Math.min(8, this.q.maxSparkles - this.sparkles.length);
    for (let i = 0; i < count; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 3 + Math.random() * 2;
      this.sparkles.push({
        x: (Math.random() - 0.5) * 0.5,
        y: 0.5 + Math.random() * 0.5,
        z: (Math.random() - 0.5) * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.abs(Math.sin(angle)) * speed + 1,
        vz: (Math.random() - 0.5) * speed,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.2,
        color: Math.random() > 0.5 ? 0xff6432 : 0xffc832,
      });
    }
  }

  // ── ENTITY POOLING ────────────────────────────────────────────────────

  private recycleEntityGroup(group: THREE.Group): void {
    // Strip children and return empty group to pool
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      // Dispose child geometries/materials
      child.traverse((obj) => { disposeMeshObj(obj); });
    }
    group.visible = false;
    group.position.set(0, -100, 0);
    this.entityPool.push(group);
  }

  private getPooledGroup(): THREE.Group {
    if (this.entityPool.length > 0) {
      const g = this.entityPool.pop()!;
      g.visible = true;
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      g.scale.set(1, 1, 1);
      return g;
    }
    return new THREE.Group();
  }

  // ── UPDATE METHODS ──────────────────────────────────────────────────────

  private updateClouds(dt: number): void {
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i]!;
      c.x -= c.speed * dt;
      if (c.x < -25) c.x = 25;
      _tmpMatrix.makeScale(c.w, c.h, c.w * 0.6);
      _tmpVec.set(c.x, c.y, c.z);
      _tmpMatrix.setPosition(_tmpVec);
      this.cloudInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.cloudInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateBuildings(state: RenderState): void {
    const bc = this.q.buildingCount;
    const scrollOffset = state.distance * 0.0003;
    // Skip update if scroll delta is tiny (< 0.01 units)
    const snapped = Math.round(scrollOffset * 100);
    if (snapped === this.lastBuildingScroll) return;
    this.lastBuildingScroll = snapped;

    const spacing = 30 / bc;
    for (let i = 0; i < bc; i++) {
      const bx = -15 + i * spacing - (scrollOffset % (bc * spacing));
      const bh = 1 + Math.abs(Math.sin(i * 2.5)) * 3 + Math.abs(Math.cos(i * 1.3)) * 2;
      const bw = 0.6;
      const bz = -8 - (i % 3) * 0.5;
      _tmpMatrix.makeScale(bw, bh, bw);
      _tmpVec.set(bx, bh / 2, bz);
      _tmpMatrix.setPosition(_tmpVec);
      this.buildingInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.buildingInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateRoad(state: RenderState): void {
    const scrollOffset = (state.distance * WORLD_SCALE) % 3;
    let dashIdx = 0;
    for (let laneDiv = 1; laneDiv <= 2; laneDiv++) {
      const z = LANE_POSITIONS[laneDiv - 1]! + (LANE_POSITIONS[laneDiv]! - LANE_POSITIONS[laneDiv - 1]!) / 2;
      for (let i = 0; i < 20 && dashIdx < this.laneDashCount; i++) {
        const x = -ROAD_WIDTH / 2 + i * 1.5 - scrollOffset;
        _tmpMatrix.identity();
        _tmpVec.set(x, 0.01, z);
        _tmpMatrix.setPosition(_tmpVec);
        this.laneDashInstanced.setMatrixAt(dashIdx, _tmpMatrix);
        dashIdx++;
      }
    }
    for (; dashIdx < this.laneDashCount; dashIdx++) {
      _tmpMatrix.makeScale(0, 0, 0);
      _tmpMatrix.setPosition(0, -100, 0);
      this.laneDashInstanced.setMatrixAt(dashIdx, _tmpMatrix);
    }
    this.laneDashInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateEntities(state: RenderState, w: number): void {
    const activeIds = new Set<number>();

    for (const entity of state.entities) {
      if (!entity.active || entity.collected) continue;
      if (entity.x > w + 50 || entity.x + entity.width < -50) continue;

      activeIds.add(entity.id);
      const worldX = entityToWorldX(entity.x + entity.width / 2, w);
      const worldZ = laneToZ(entity.lane);

      let group = this.entityMeshes.get(entity.id);
      if (!group) {
        group = this.getPooledGroup();
        this.buildEntityMesh(group, entity);
        this.entityMeshes.set(entity.id, group);
        this.entityGroup.add(group);
      }

      group.position.set(worldX, 0, worldZ);
      group.visible = true;

      // Animate collectibles (spin + float)
      if (entity.type === "collectible") {
        group.rotation.y = this.frameCount * 0.05 + entity.id;
        group.position.y = 0.3 + Math.sin(this.frameCount * 0.08 + entity.id) * 0.15;
      }

      // Animate dogs (walk cycle)
      if (entity.type === "obstacle" && entity.subType === "dog") {
        group.position.y = Math.sin(this.frameCount * 0.15) * 0.05;
      }

      // Oil slick shimmer
      if (entity.type === "obstacle" && entity.subType === "oil-slick") {
        const mesh = group.children[0] as THREE.Mesh | undefined;
        if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          const hue = (this.frameCount * 0.01 + entity.id) % 1;
          mesh.material.color.setHSL(hue, 0.6, 0.15);
        }
      }
    }

    // Remove inactive entities — recycle to pool
    for (const [id, group] of this.entityMeshes) {
      if (!activeIds.has(id)) {
        this.entityGroup.remove(group);
        this.recycleEntityGroup(group);
        this.entityMeshes.delete(id);
      }
    }
  }

  private buildEntityMesh(group: THREE.Group, entity: GameEntity): void {
    switch (entity.type) {
      case "obstacle":
        this.buildObstacleMesh(group, entity);
        break;
      case "collectible":
        this.buildCollectibleMesh(group, entity);
        break;
      case "shop":
        this.buildShopMesh(group, entity);
        break;
    }
  }

  private buildObstacleMesh(group: THREE.Group, entity: GameEntity): void {
    const d = this.q.geoDetail;
    const shadows = this.q.shadowsEnabled;

    switch (entity.subType) {
      case "car": {
        const palette = CAR_PALETTES[entity.id % CAR_PALETTES.length]!;
        const bodyW = entity.width * WORLD_SCALE;
        const bodyH = 0.5;
        const bodyD = entity.height * WORLD_SCALE;

        // Car body — Lambert (many cars on screen)
        const bodyGeo = cachedGeo("car-body", () => new THREE.BoxGeometry(1, 1, 1));
        const bodyMat = new THREE.MeshLambertMaterial({ color: palette.body });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(bodyW, bodyH, bodyD);
        body.position.y = bodyH / 2 + 0.1;
        body.castShadow = shadows;
        body.receiveShadow = shadows;
        group.add(body);

        // Roof
        const roofGeo = cachedGeo("car-roof", () => new THREE.BoxGeometry(1, 1, 1));
        const roofMat = new THREE.MeshLambertMaterial({ color: palette.roof });
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.scale.set(bodyW * 0.4, 0.25, bodyD * 0.8);
        roof.position.set(0, bodyH + 0.2, 0);
        roof.castShadow = shadows;
        group.add(roof);

        // Headlights — emissive BasicMaterial (cheapest)
        const hlGeo = cachedGeo("car-hl", () => new THREE.SphereGeometry(0.06, seg(4, d), seg(4, d)));
        const hlMat = new THREE.MeshBasicMaterial({ color: 0xfde68a });
        const hl1 = new THREE.Mesh(hlGeo, hlMat);
        hl1.position.set(bodyW / 2, bodyH / 2 + 0.1, bodyD * 0.3);
        group.add(hl1);
        const hl2 = new THREE.Mesh(hlGeo, hlMat);
        hl2.position.set(bodyW / 2, bodyH / 2 + 0.1, -bodyD * 0.3);
        group.add(hl2);

        // Taillights
        const tlGeo = cachedGeo("car-tl", () => new THREE.SphereGeometry(0.05, seg(4, d), seg(4, d)));
        const tlMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const tl1 = new THREE.Mesh(tlGeo, tlMat);
        tl1.position.set(-bodyW / 2, bodyH / 2 + 0.1, bodyD * 0.3);
        group.add(tl1);
        const tl2 = new THREE.Mesh(tlGeo, tlMat);
        tl2.position.set(-bodyW / 2, bodyH / 2 + 0.1, -bodyD * 0.3);
        group.add(tl2);

        // Wheels
        const wGeo = cachedGeo("car-wheel", () => {
          const g = new THREE.CylinderGeometry(0.12, 0.12, 1, seg(6, d));
          g.rotateX(Math.PI / 2);
          return g;
        });
        const wMat = cachedMat("car-wheel-mat", () => new THREE.MeshLambertMaterial({ color: 0x1a1a1a })) as THREE.MeshLambertMaterial;
        const fw = new THREE.Mesh(wGeo, wMat);
        fw.scale.set(1, 1, bodyD + 0.1);
        fw.position.set(bodyW * 0.35, 0.1, 0);
        group.add(fw);
        const rw = new THREE.Mesh(wGeo, wMat);
        rw.scale.set(1, 1, bodyD + 0.1);
        rw.position.set(-bodyW * 0.35, 0.1, 0);
        group.add(rw);
        break;
      }

      case "pothole": {
        const geo = cachedGeo("pothole", () =>
          new THREE.CylinderGeometry(0.5, 0.4, 0.1, seg(8, d)),
        );
        const mat = cachedMat("pothole-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x0a0a0a }),
        ) as THREE.MeshLambertMaterial;
        const mesh = new THREE.Mesh(geo, mat);
        const r = entity.width * WORLD_SCALE / 2;
        mesh.scale.set(r * 2, 1, r * 2);
        mesh.position.y = -0.03;
        group.add(mesh);
        break;
      }

      case "oil-slick": {
        const geo = cachedGeo("oil", () =>
          new THREE.CylinderGeometry(0.5, 0.5, 0.02, seg(10, d)),
        );
        const mat = new THREE.MeshStandardMaterial({
          color: 0x111111, roughness: 0.1, metalness: 0.9,
        });
        const mesh = new THREE.Mesh(geo, mat);
        const r = entity.width * WORLD_SCALE / 2;
        mesh.scale.set(r * 2, 1, r * 2);
        mesh.position.y = 0.01;
        group.add(mesh);
        break;
      }

      case "traffic-cone": {
        const coneH = entity.height * WORLD_SCALE;
        const coneR = entity.width * WORLD_SCALE / 2;
        const geo = cachedGeo("cone", () => new THREE.ConeGeometry(1, 1, seg(6, d)));
        const mat = cachedMat("cone-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0xf97316 }),
        ) as THREE.MeshLambertMaterial;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(coneR, coneH, coneR);
        mesh.position.y = coneH / 2;
        mesh.castShadow = shadows;
        group.add(mesh);

        // Base
        const baseGeo = cachedGeo("cone-base", () => new THREE.BoxGeometry(1, 0.05, 1));
        const baseMat = cachedMat("cone-base-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x333333 }),
        ) as THREE.MeshLambertMaterial;
        const base = new THREE.Mesh(baseGeo, baseMat);
        const bScale = entity.width * WORLD_SCALE * 1.2;
        base.scale.set(bScale, 1, bScale);
        base.position.y = 0.025;
        group.add(base);
        break;
      }

      case "dog": {
        const bodyGeo = cachedGeo("dog-body", () => new THREE.BoxGeometry(0.6, 0.25, 0.3));
        const bodyMat = cachedMat("dog-body-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x8b5e3c }),
        ) as THREE.MeshLambertMaterial;
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.35;
        body.castShadow = shadows;
        group.add(body);

        const headGeo = cachedGeo("dog-head", () =>
          new THREE.SphereGeometry(0.12, seg(6, d), seg(6, d)),
        );
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.set(0.3, 0.45, 0);
        group.add(head);

        // Simplified: snout + nose as one box
        const snoutGeo = cachedGeo("dog-snout", () => new THREE.BoxGeometry(0.1, 0.06, 0.08));
        const snoutMat = cachedMat("dog-snout-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x7a4f32 }),
        ) as THREE.MeshLambertMaterial;
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0.4, 0.42, 0);
        group.add(snout);

        // Legs (4 cylinders)
        const legGeo = cachedGeo("dog-leg", () =>
          new THREE.CylinderGeometry(0.03, 0.03, 0.2, seg(4, d)),
        );
        const legMat = cachedMat("dog-leg-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x7a4f32 }),
        ) as THREE.MeshLambertMaterial;
        const legPositions = [[0.2, 0.1, 0.12], [0.2, 0.1, -0.12], [-0.2, 0.1, 0.12], [-0.2, 0.1, -0.12]];
        for (const pos of legPositions) {
          const leg = new THREE.Mesh(legGeo, legMat);
          leg.position.set(pos[0]!, pos[1]!, pos[2]!);
          group.add(leg);
        }
        break;
      }
    }
  }

  private buildCollectibleMesh(group: THREE.Group, entity: GameEntity): void {
    const d = this.q.geoDetail;

    switch (entity.subType) {
      case "spark-plug": {
        const bodyGeo = cachedGeo("sp-body", () =>
          new THREE.CylinderGeometry(0.08, 0.06, 0.4, seg(6, d)),
        );
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0xc0c0c0, emissive: 0xffd700, emissiveIntensity: 0.8,
          roughness: 0.3, metalness: 0.7,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.2;
        group.add(body);
        break;
      }

      case "jet": {
        const geo = cachedGeo("jet", () =>
          new THREE.SphereGeometry(0.2, seg(8, d), seg(8, d)),
        );
        const mat = new THREE.MeshStandardMaterial({
          color: 0xdaa520, emissive: 0xdaa520, emissiveIntensity: 1.5,
          roughness: 0.3, metalness: 0.6,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.2;
        group.add(mesh);
        break;
      }

      case "pipe": {
        const geo = cachedGeo("pipe", () =>
          new THREE.CylinderGeometry(0.06, 0.06, 0.6, seg(6, d)),
        );
        const mat = new THREE.MeshStandardMaterial({
          color: 0xb0b0b0, emissive: 0xffd700, emissiveIntensity: 0.6,
          roughness: 0.2, metalness: 0.8,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.y = 0.2;
        group.add(mesh);
        break;
      }

      case "cylinder": {
        const geo = cachedGeo("cyl", () =>
          new THREE.CylinderGeometry(0.15, 0.15, 0.5, seg(8, d)),
        );
        const mat = new THREE.MeshStandardMaterial({
          color: 0xdaa520, emissive: 0xffd700, emissiveIntensity: 2,
          roughness: 0.2, metalness: 0.7,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.25;
        group.add(mesh);

        // Simplified: 2 fins instead of 4
        const finGeo = cachedGeo("cyl-fin", () => new THREE.BoxGeometry(0.35, 0.02, 0.35));
        for (let i = 0; i < 2; i++) {
          const fin = new THREE.Mesh(finGeo, mat);
          fin.position.y = 0.15 + i * 0.2;
          group.add(fin);
        }
        break;
      }
    }
  }

  private buildShopMesh(group: THREE.Group, entity: GameEntity): void {
    const brand = SHOP_BRANDS[entity.subType] ?? { bg: 0x666666, trim: 0x999999, awning: 0x555555, text: "SHOP" };
    const shopW = entity.width * WORLD_SCALE;
    const shopH = 1.5;
    const shopD = entity.height * WORLD_SCALE;
    const shadows = this.q.shadowsEnabled;

    // Building — Lambert
    const bodyGeo = cachedGeo("shop-body", () => new THREE.BoxGeometry(1, 1, 1));
    const bodyMat = new THREE.MeshLambertMaterial({ color: brand.bg });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.scale.set(shopW, shopH, shopD);
    body.position.y = shopH / 2;
    body.castShadow = shadows;
    group.add(body);

    // Awning
    const awningGeo = cachedGeo("shop-awning", () => new THREE.BoxGeometry(1, 0.08, 1));
    const awningMat = new THREE.MeshLambertMaterial({ color: brand.awning });
    const awning = new THREE.Mesh(awningGeo, awningMat);
    awning.scale.set(shopW + 0.3, 1, shopD + 0.4);
    awning.position.y = shopH + 0.05;
    group.add(awning);

    // Sign (emissive for bloom)
    const signGeo = cachedGeo("shop-sign", () => new THREE.BoxGeometry(1, 0.3, 0.05));
    const signMat = new THREE.MeshStandardMaterial({
      color: brand.trim, emissive: brand.trim, emissiveIntensity: 1.5, roughness: 0.3,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.scale.set(shopW * 0.8, 1, 1);
    sign.position.set(0, shopH * 0.7, shopD / 2 + 0.03);
    group.add(sign);
  }

  // ── MOPED UPDATE ────────────────────────────────────────────────────────

  private updateMoped(state: RenderState): void {
    if (!this.mopedParts) return;

    const targetZ = laneToZ(state.player.targetLane);
    const currentZ = laneToZ(state.player.lane);
    const t = state.player.laneProgress;
    const eased = 1 - (1 - t) * (1 - t);
    const mopedZ = currentZ + (targetZ - currentZ) * eased;

    this.mopedGroup.position.set(0, 0, mopedZ);

    // Wheelie
    if (state.player.isWheeling) {
      const wheelieProgress = state.player.wheelieTimer / 500;
      this.mopedGroup.rotation.z = Math.sin(wheelieProgress * Math.PI) * 0.3;
      this.mopedGroup.position.y = Math.sin(wheelieProgress * Math.PI) * 0.4;
    } else {
      this.mopedGroup.rotation.z = 0;
      this.mopedGroup.position.y = 0;
    }

    // Spin wheels
    const wheelSpeed = state.speed * 0.01;
    this.mopedParts.rearWheel.rotation.z += wheelSpeed * 0.016;
    this.mopedParts.frontWheel.rotation.z += wheelSpeed * 0.016;

    // Invincibility blink
    if (state.player.isInvincible) {
      this.mopedGroup.visible = Math.sin(state.player.invincibleTimer * 0.01) > 0;
    } else {
      this.mopedGroup.visible = true;
    }
  }

  // ── PARTICLES UPDATE ────────────────────────────────────────────────────

  private updateParticles(state: RenderState, dt: number): void {
    const maxE = this.q.maxExhaust;
    const mopedZ = laneToZ(state.player.lane);
    const exhaustX = -0.9;
    const exhaustY = 0.45;

    // Spawn exhaust
    const speedNorm = Math.min(state.speed / 500, 1);
    const spawnRate = speedNorm * 3;
    if (Math.random() < spawnRate * dt * 60 && this.particles.length < maxE) {
      this.particles.push({
        x: exhaustX + (Math.random() - 0.5) * 0.1,
        y: exhaustY + (Math.random() - 0.5) * 0.1,
        z: mopedZ + (Math.random() - 0.5) * 0.1,
        vx: -1 - Math.random() * 2 - state.speed * 0.005,
        vy: 0.5 + Math.random() * 1,
        vz: (Math.random() - 0.5) * 0.3,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        size: 0.05 + Math.random() * 0.08,
      });
    }

    // Update
    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.maxLife) return false;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size += dt * 0.15;
      return true;
    });

    // Write to instanced mesh — only write active count + 1 (to hide last)
    const writeCount = Math.min(this.particles.length + 1, maxE);
    for (let i = 0; i < writeCount; i++) {
      if (i < this.particles.length) {
        const p = this.particles[i]!;
        const s = p.size * (1 + p.life * 3);
        _tmpMatrix.makeScale(s, s, s);
        _tmpVec.set(p.x, p.y, p.z);
        _tmpMatrix.setPosition(_tmpVec);
      } else {
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -100, 0);
      }
      this.exhaustInstanced.setMatrixAt(i, _tmpMatrix);
    }
    // If count shrunk, hide the slot after the new end
    this.exhaustInstanced.instanceMatrix.needsUpdate = true;
    this.exhaustInstanced.count = Math.max(this.particles.length, 1);
  }

  private updateSparkles(dt: number): void {
    const maxS = this.q.maxSparkles;

    this.sparkles = this.sparkles.filter((s) => {
      s.life += dt;
      if (s.life >= s.maxLife) return false;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 8 * dt;
      return true;
    });

    const writeCount = Math.min(this.sparkles.length + 1, maxS);
    for (let i = 0; i < writeCount; i++) {
      if (i < this.sparkles.length) {
        const s = this.sparkles[i]!;
        const alpha = 1 - s.life / s.maxLife;
        const sc = 0.08 * alpha;
        _tmpMatrix.makeScale(sc, sc, sc);
        _tmpVec.set(s.x, s.y, s.z);
        _tmpMatrix.setPosition(_tmpVec);
        this.sparkleInstanced.setMatrixAt(i, _tmpMatrix);
        this.sparkleInstanced.setColorAt(i, _tmpColor.setHex(s.color));
      } else {
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -100, 0);
        this.sparkleInstanced.setMatrixAt(i, _tmpMatrix);
      }
    }
    this.sparkleInstanced.instanceMatrix.needsUpdate = true;
    if (this.sparkleInstanced.instanceColor) {
      this.sparkleInstanced.instanceColor.needsUpdate = true;
    }
    this.sparkleInstanced.count = Math.max(this.sparkles.length, 1);
  }

  private updateSpeedLines(state: RenderState, dt: number): void {
    const maxSL = this.q.maxSpeedLines;

    if (state.speed < 250) {
      if (this.speedLines.length > 0) {
        this.speedLines = [];
        this.speedLineInstanced.count = 1;
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -100, 0);
        this.speedLineInstanced.setMatrixAt(0, _tmpMatrix);
        this.speedLineInstanced.instanceMatrix.needsUpdate = true;
      }
      return;
    }

    const intensity = Math.min((state.speed - 250) / 200, 1);

    if (Math.random() < intensity * dt * 40 && this.speedLines.length < maxSL) {
      this.speedLines.push({
        x: 15 + Math.random() * 5,
        z: ROAD_Z_MIN + Math.random() * (ROAD_Z_MAX - ROAD_Z_MIN),
        length: 0.5 + Math.random() * 2 * intensity,
        speed: 15 + state.speed * 0.04 + Math.random() * 5,
      });
    }

    this.speedLines = this.speedLines.filter((sl) => {
      sl.x -= sl.speed * dt;
      return sl.x + sl.length > -15;
    });

    const writeCount = Math.min(this.speedLines.length + 1, maxSL);
    for (let i = 0; i < writeCount; i++) {
      if (i < this.speedLines.length) {
        const sl = this.speedLines[i]!;
        _tmpMatrix.makeScale(sl.length, 1, 1);
        _tmpVec.set(sl.x, 0.1, sl.z);
        _tmpMatrix.setPosition(_tmpVec);
      } else {
        _tmpMatrix.makeScale(0, 0, 0);
        _tmpMatrix.setPosition(0, -100, 0);
      }
      this.speedLineInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.speedLineInstanced.instanceMatrix.needsUpdate = true;
    this.speedLineInstanced.count = Math.max(this.speedLines.length, 1);
  }

  // ── EFFECTS ─────────────────────────────────────────────────────────────

  private updateShake(state: RenderState): void {
    const shakeIntensity = state.hitFlashTimer > 0 ? 6 : state.speed > 400 ? 1.5 : 0;
    if (shakeIntensity > 0) {
      this.shakeOffset.x = (Math.random() - 0.5) * shakeIntensity;
      this.shakeOffset.y = (Math.random() - 0.5) * shakeIntensity;
    } else {
      this.shakeOffset.x *= 0.9;
      this.shakeOffset.y *= 0.9;
    }
  }

  private updateHitFlash(state: RenderState): void {
    const mat = this.hitFlashPlane.material as THREE.MeshBasicMaterial;
    if (state.hitFlashTimer > 0) {
      mat.opacity = Math.min(state.hitFlashTimer / 200, 0.4);
    } else {
      mat.opacity = 0;
    }
    this.hitFlashPlane.position.copy(this.camera.position);
    this.hitFlashPlane.quaternion.copy(this.camera.quaternion);
    this.hitFlashPlane.translateZ(-2);
  }

  private updateBloom(state: RenderState): void {
    if (!this.bloomPass) return;
    const speedNorm = Math.min(state.speed / 500, 1);
    this.bloomPass.strength = 0.4 + speedNorm * 0.4;
  }
}
