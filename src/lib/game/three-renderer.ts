import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { RenderState, MopedMake, GameEntity } from "./types";
import {
  EAST_BAY_ZONES,
  PLAYER_X_POSITION,
  VIRTUAL_WIDTH,
} from "./types";
import { getMopedStats } from "./moped-stats";

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
  streetPropCount: number;
  geoDetail: number;
  antialias: boolean;
}

const QUALITY: Record<QualityTier, QualitySettings> = {
  low: {
    pixelRatioCap: 1,
    shadowMapSize: 0,
    shadowsEnabled: false,
    bloomEnabled: false,
    bloomResScale: 0,
    maxExhaust: 45,
    maxSparkles: 28,
    maxSpeedLines: 18,
    buildingCount: 24,
    cloudCount: 5,
    streetPropCount: 8,
    geoDetail: 0.55,
    antialias: false,
  },
  medium: {
    pixelRatioCap: 1.5,
    shadowMapSize: 512,
    shadowsEnabled: true,
    bloomEnabled: true,
    bloomResScale: 0.5,
    maxExhaust: 90,
    maxSparkles: 60,
    maxSpeedLines: 34,
    buildingCount: 38,
    cloudCount: 8,
    streetPropCount: 12,
    geoDetail: 0.8,
    antialias: true,
  },
  high: {
    pixelRatioCap: 2,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    bloomEnabled: true,
    bloomResScale: 1,
    maxExhaust: 150,
    maxSparkles: 96,
    maxSpeedLines: 55,
    buildingCount: 52,
    cloudCount: 12,
    streetPropCount: 16,
    geoDetail: 1,
    antialias: true,
  },
};

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const WORLD_SCALE = 1 / 30;
const ROAD_Z_MIN = -3.1;
const ROAD_Z_MAX = 3.1;
const ROAD_WIDTH = 34;
const LANE_POSITIONS = [-1.6, 0, 1.6];

const MOPED_COLORS: Record<
  MopedMake,
  { frame: number; accent: number; seat: number; jacket: number }
> = {
  "puch-maxi": {
    frame: 0xffffff,
    accent: 0x22c55e,
    seat: 0x18181b,
    jacket: 0x111827,
  },
  "honda-hobbit": {
    frame: 0xef4444,
    accent: 0xffffff,
    seat: 0x18181b,
    jacket: 0x1f2937,
  },
  "derbi-variant": {
    frame: 0x2563eb,
    accent: 0xffd700,
    seat: 0x111827,
    jacket: 0x0f172a,
  },
  "tomos-a35": {
    frame: 0x4b5563,
    accent: 0xe5e7eb,
    seat: 0x111827,
    jacket: 0x18181b,
  },
};

const CAR_PALETTES = [
  { body: 0xdc2626, roof: 0xb91c1c },
  { body: 0x2563eb, roof: 0x1d4ed8 },
  { body: 0xf5f5f5, roof: 0xd4d4d4 },
  { body: 0x6b7280, roof: 0x4b5563 },
  { body: 0x16a34a, roof: 0x15803d },
  { body: 0xeab308, roof: 0xca8a04 },
  { body: 0x7c3aed, roof: 0x6d28d9 },
  { body: 0x1f2937, roof: 0x111827 },
];

const SHOP_BRANDS: Record<
  string,
  {
    bg: number;
    trim: number;
    bannerHex: string;
    borderHex: string;
    text: string;
    perk: string;
  }
> = {
  treatland: {
    bg: 0x14532d,
    trim: 0x4ade80,
    bannerHex: "#14532d",
    borderHex: "#4ade80",
    text: "TREATLAND",
    perk: "TURBO BOOST",
  },
  "1977-mopeds": {
    bg: 0x1e3a8a,
    trim: 0x60a5fa,
    bannerHex: "#1e3a8a",
    borderHex: "#60a5fa",
    text: "1977 MOPEDS",
    perk: "+1 HP REPAIR",
  },
  "myrons-mopeds": {
    bg: 0x7c2d12,
    trim: 0xfb923c,
    bannerHex: "#7c2d12",
    borderHex: "#fb923c",
    text: "MYRON'S",
    perk: "PART MAGNET",
  },
};

// ── PARTICLE DATA ──────────────────────────────────────────────────────────

interface Particle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

interface Sparkle3D {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: number;
}

interface SpeedLine3D {
  x: number;
  z: number;
  length: number;
  speed: number;
}

interface BuildingMeta {
  baseX: number;
  w: number;
  h: number;
  d: number;
  z: number;
  colorHex: number;
}

interface StreetProp {
  group: THREE.Group;
  offset: number;
  side: -1 | 1;
}

// ── HELPERS ────────────────────────────────────────────────────────────────

function laneToZ(lane: number): number {
  const clamped = Math.max(0, Math.min(2, lane));
  const lo = Math.floor(clamped);
  const hi = Math.min(2, lo + 1);
  const frac = clamped - lo;
  const zLo = LANE_POSITIONS[lo] ?? 0;
  const zHi = LANE_POSITIONS[hi] ?? 0;
  return zLo + (zHi - zLo) * frac;
}

function entityToWorldX(entityX: number): number {
  const playerVirtualX = VIRTUAL_WIDTH * PLAYER_X_POSITION;
  return (entityX - playerVirtualX) * WORLD_SCALE;
}

function disposeMeshObj(obj: THREE.Object3D): void {
  if (!("geometry" in obj)) return;
  const mesh = obj as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.Material | THREE.Material[]
  >;
  if (mesh.geometry && !mesh.geometry.userData?.shared) {
    mesh.geometry.dispose();
  }
  const mat = mesh.material;
  if (Array.isArray(mat)) {
    for (const m of mat) {
      if (m && !m.userData?.shared) {
        m.dispose();
      }
    }
  } else if (mat && !mat.userData?.shared) {
    mat.dispose();
  }
}

function seg(base: number, detail: number): number {
  return Math.max(4, Math.round(base * detail));
}

function detectTier(): QualityTier {
  try {
    const probeCanvas = document.createElement("canvas");
    const gl =
      probeCanvas.getContext("webgl2") ?? probeCanvas.getContext("webgl");
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const gpuRenderer = gl.getParameter(
          debugInfo.UNMASKED_RENDERER_WEBGL,
        ) as string | null;
        if (gpuRenderer) {
          const lower = gpuRenderer.toLowerCase();
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
            gl.getExtension("WEBGL_lose_context")?.loseContext();
            return "low";
          }
          if (
            lower.includes("adreno 5") ||
            lower.includes("adreno 6") ||
            lower.includes("apple gpu") ||
            lower.includes("intel iris")
          ) {
            gl.getExtension("WEBGL_lose_context")?.loseContext();
            return "medium";
          }
        }
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    // Fall through to UA / viewport heuristics
  }

  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return "low";
  }

  if (window.innerWidth < 800) {
    return "medium";
  }

  return "high";
}

function getEffectiveFrustum(aspect: number): number {
  const baseFrustum = 7.4;
  return Math.max(baseFrustum, 10.6 / Math.max(aspect, 0.52));
}

const _tmpMatrix = new THREE.Matrix4();
const _tmpColor = new THREE.Color();
const _tmpVec = new THREE.Vector3();
const _targetSkyTop = new THREE.Color();
const _targetSkyBottom = new THREE.Color();
const _targetSun = new THREE.Color();
const _targetHill = new THREE.Color();

// ── THREE RENDERER CLASS ──────────────────────────────────────────────────

export class ThreeRenderer {
  private sharedGeoCache = new Map<string, THREE.BufferGeometry>();
  private sharedMatCache = new Map<string, THREE.Material>();
  private sharedTexCache = new Map<string, THREE.Texture>();
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
  private currentAspect = 1.6;
  private currentZoom = 1;

  // Groups
  private skyGroup!: THREE.Group;
  private bgGroup!: THREE.Group;
  private roadGroup!: THREE.Group;
  private propGroup!: THREE.Group;
  private entityGroup!: THREE.Group;
  private mopedGroup!: THREE.Group;
  private particleGroup!: THREE.Group;

  // Lights
  private dirLight!: THREE.DirectionalLight | null;
  private ambientLight!: THREE.AmbientLight;

  // Sky & Zone Atmosphere
  private skyMat!: THREE.ShaderMaterial;
  private sunMesh!: THREE.Mesh;
  private sunLight!: THREE.PointLight;
  private cloudInstanced!: THREE.InstancedMesh;
  private cloudData: {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    speed: number;
  }[] = [];

  // Background
  private hillMesh!: THREE.Mesh;
  private hillMat!: THREE.MeshLambertMaterial;
  private bridgeGroup!: THREE.Group;
  private buildingInstanced!: THREE.InstancedMesh;
  private buildingMeta: BuildingMeta[] = [];
  private lastBuildingScroll = -1;

  // Road & Sidewalk Props
  private roadPlane!: THREE.Mesh;
  private laneDashInstanced!: THREE.InstancedMesh;
  private laneDashCount = 44;
  private lastRoadScrollOffset = -1;
  private streetProps: StreetProp[] = [];

  // Entities pool
  private entityMeshes = new Map<number, THREE.Group>();
  private entityPool: THREE.Group[] = [];

  // Moped parts
  private mopedParts!: {
    rearWheel: THREE.Group;
    frontWheel: THREE.Group;
    rider: THREE.Group;
    headlightBeam: THREE.Mesh;
    magnetHalo: THREE.Mesh;
  };
  private currentMake: MopedMake = "puch-maxi";
  private currentMopedZ = 0;
  private currentMopedY = 0;

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
  private shakeIntensity = 0;
  private shakeOffset = { x: 0, y: 0 };
  private baseCameraPos = new THREE.Vector3();

  constructor(parentEl: HTMLElement) {
    this.parentEl = parentEl;
  }

  private cachedGeo(
    key: string,
    factory: () => THREE.BufferGeometry,
  ): THREE.BufferGeometry {
    let g = this.sharedGeoCache.get(key);
    if (!g) {
      g = factory();
      g.userData.shared = true;
      this.sharedGeoCache.set(key, g);
    }
    return g;
  }

  private cachedMat(
    key: string,
    factory: () => THREE.Material,
  ): THREE.Material {
    let m = this.sharedMatCache.get(key);
    if (!m) {
      m = factory();
      m.userData.shared = true;
      this.sharedMatCache.set(key, m);
    }
    return m;
  }

  private cachedTexture(
    key: string,
    factory: () => THREE.Texture,
  ): THREE.Texture {
    let t = this.sharedTexCache.get(key);
    if (!t) {
      t = factory();
      this.sharedTexCache.set(key, t);
    }
    return t;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const rect = this.parentEl.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);

    this.tier = detectTier();
    this.q = QUALITY[this.tier];

    this.webglRenderer = new THREE.WebGLRenderer({
      antialias: this.q.antialias,
      alpha: false,
      powerPreference: "high-performance",
    });

    this.webglRenderer.setSize(w, h);
    this.webglRenderer.setPixelRatio(
      Math.min(window.devicePixelRatio, this.q.pixelRatioCap),
    );

    if (this.q.shadowsEnabled) {
      this.webglRenderer.shadowMap.enabled = true;
      this.webglRenderer.shadowMap.type = THREE.PCFShadowMap;
    } else {
      this.webglRenderer.shadowMap.enabled = false;
    }

    this.webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.webglRenderer.toneMappingExposure = 1.15;
    this.parentEl.appendChild(this.webglRenderer.domElement);
    this.webglRenderer.domElement.style.width = "100%";
    this.webglRenderer.domElement.style.height = "100%";
    this.webglRenderer.domElement.style.display = "block";

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera — punchy isometric-arcade 2.5D angle
    this.currentAspect = w / h;
    const frustum = getEffectiveFrustum(this.currentAspect);
    this.camera = new THREE.OrthographicCamera(
      -frustum * this.currentAspect,
      frustum * this.currentAspect,
      frustum,
      -frustum,
      0.1,
      200,
    );
    this.camera.position.set(5.5, 9.2, 9.8);
    this.camera.lookAt(1.8, 0.2, 0);
    this.baseCameraPos.copy(this.camera.position);

    // Post-processing bloom
    if (this.q.bloomEnabled) {
      this.composer = new EffectComposer(this.webglRenderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const bloomW = Math.round(w * this.q.bloomResScale);
      const bloomH = Math.round(h * this.q.bloomResScale);
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(bloomW, bloomH),
        0.52,
        0.4,
        0.86,
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
    this.propGroup = new THREE.Group();
    this.entityGroup = new THREE.Group();
    this.mopedGroup = new THREE.Group();
    this.particleGroup = new THREE.Group();
    this.scene.add(
      this.skyGroup,
      this.bgGroup,
      this.roadGroup,
      this.propGroup,
      this.entityGroup,
      this.mopedGroup,
      this.particleGroup,
    );

    this.setupLights();
    this.buildSky();
    this.buildBackground();
    this.buildRoad();
    this.buildStreetProps();
    this.buildMoped("puch-maxi");
    this.buildParticles();
    this.buildHitFlash();

    this.initialized = true;
  }

  // ── LIGHTS ──────────────────────────────────────────────────────────────

  private setupLights(): void {
    this.ambientLight = new THREE.AmbientLight(
      0xffeedd,
      this.q.shadowsEnabled ? 0.65 : 0.9,
    );
    this.scene.add(this.ambientLight);

    if (this.q.shadowsEnabled) {
      this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.3);
      this.dirLight.position.set(10, 16, 6);
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.set(
        this.q.shadowMapSize,
        this.q.shadowMapSize,
      );
      this.dirLight.shadow.camera.left = -16;
      this.dirLight.shadow.camera.right = 18;
      this.dirLight.shadow.camera.top = 9;
      this.dirLight.shadow.camera.bottom = -9;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 40;
      this.dirLight.shadow.bias = -0.002;
      this.scene.add(this.dirLight);
      this.scene.add(this.dirLight.target);
    } else {
      this.dirLight = new THREE.DirectionalLight(0xfff5e0, 1.1);
      this.dirLight.position.set(10, 15, 6);
      this.dirLight.castShadow = false;
      this.scene.add(this.dirLight);
    }
  }

  // ── SKY ─────────────────────────────────────────────────────────────────

  private buildSky(): void {
    const d = this.q.geoDetail;
    const zone0 = EAST_BAY_ZONES[0]!;

    const skyGeo = new THREE.PlaneGeometry(90, 44);
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(zone0.skyTop) },
        uBottomColor: { value: new THREE.Color(zone0.skyBottom) },
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
          float t = smoothstep(0.05, 0.92, vUv.y);
          gl_FragColor = vec4(mix(uBottomColor, uTopColor, t), 1.0);
        }
      `,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const skyPlane = new THREE.Mesh(skyGeo, this.skyMat);
    skyPlane.position.set(2, 9, -26);
    skyPlane.renderOrder = -1;
    this.skyGroup.add(skyPlane);

    // Sun / Moon orb
    const sunGeo = new THREE.SphereGeometry(1.45, seg(14, d), seg(14, d));
    const sunMat = new THREE.MeshBasicMaterial({ color: zone0.sunColor });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunMesh.position.set(14, 12.5, -21);
    this.skyGroup.add(this.sunMesh);

    this.sunLight = new THREE.PointLight(0xffdc64, 0.6, 55);
    this.sunLight.position.copy(this.sunMesh.position);
    this.skyGroup.add(this.sunLight);

    // Clouds
    const cloudGeo = new THREE.BoxGeometry(2.2, 0.45, 0.9);
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
    });
    this.cloudInstanced = new THREE.InstancedMesh(
      cloudGeo,
      cloudMat,
      this.q.cloudCount,
    );
    this.skyGroup.add(this.cloudInstanced);

    this.cloudData = [];
    for (let i = 0; i < this.q.cloudCount; i++) {
      const data = {
        x: (Math.random() - 0.5) * 44,
        y: 6.5 + Math.random() * 6,
        z: -18 - Math.random() * 7,
        w: 1.6 + Math.random() * 2.2,
        h: 0.32 + Math.random() * 0.28,
        speed: 0.35 + Math.random() * 0.55,
      };
      this.cloudData.push(data);
      _tmpMatrix.makeScale(data.w, data.h, data.w * 0.6);
      _tmpMatrix.setPosition(data.x, data.y, data.z);
      this.cloudInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.cloudInstanced.instanceMatrix.needsUpdate = true;
  }

  // ── BACKGROUND (OAKLAND HILLS, BAY BRIDGE SILHOUETTE & SKYLINE) ─────────

  private buildBackground(): void {
    // Oakland Hills silhouette
    const hillShape = new THREE.Shape();
    hillShape.moveTo(-24, 0);
    for (let x = -24; x <= 26; x += 1) {
      const y =
        Math.sin(x * 0.26) * 1.6 +
        Math.sin(x * 0.13 + 1.2) * 2.1 +
        2.4;
      hillShape.lineTo(x, y);
    }
    hillShape.lineTo(26, 0);
    hillShape.closePath();

    const hillGeo = new THREE.ExtrudeGeometry(hillShape, {
      depth: 3,
      bevelEnabled: false,
    });
    this.hillMat = new THREE.MeshLambertMaterial({
      color: EAST_BAY_ZONES[0]!.hillColor,
    });
    this.hillMesh = new THREE.Mesh(hillGeo, this.hillMat);
    this.hillMesh.rotation.x = -Math.PI / 2;
    this.hillMesh.position.set(0, 0, -14);
    this.bgGroup.add(this.hillMesh);

    // Distant Bay Bridge tower & port crane silhouettes
    this.bridgeGroup = new THREE.Group();
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x26263d });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });

    // Bay Bridge twin suspension towers
    for (const tx of [-6, 8]) {
      const tower = new THREE.Group();
      const legGeo = new THREE.BoxGeometry(0.22, 6.2, 0.22);
      const legL = new THREE.Mesh(legGeo, steelMat);
      legL.position.set(-0.55, 3.1, 0);
      const legR = new THREE.Mesh(legGeo, steelMat);
      legR.position.set(0.55, 3.1, 0);
      tower.add(legL, legR);

      const braceGeo = new THREE.BoxGeometry(1.3, 0.18, 0.22);
      for (const by of [2.2, 4.1, 5.8]) {
        const brace = new THREE.Mesh(braceGeo, steelMat);
        brace.position.set(0, by, 0);
        tower.add(brace);
      }

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 6, 6),
        beaconMat,
      );
      beacon.position.set(0, 6.35, 0);
      tower.add(beacon);

      tower.position.set(tx, 0, -16.5);
      this.bridgeGroup.add(tower);
    }
    // Bridge deck span
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(36, 0.25, 0.4),
      steelMat,
    );
    deck.position.set(1, 1.8, -16.5);
    this.bridgeGroup.add(deck);
    this.bgGroup.add(this.bridgeGroup);

    // Varied East Bay skyline buildings
    const bc = this.q.buildingCount;
    const buildGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      emissive: 0x16162a,
      emissiveIntensity: 0.35,
    });
    this.buildingInstanced = new THREE.InstancedMesh(buildGeo, buildMat, bc);
    this.buildingInstanced.castShadow = false;
    this.buildingInstanced.receiveShadow = false;
    this.bgGroup.add(this.buildingInstanced);

    const spacing = 36 / bc;
    const palette = [0x1c1c34, 0x262244, 0x1e293b, 0x2f2547, 0x1f2438];
    this.buildingMeta = [];

    for (let i = 0; i < bc; i++) {
      const h =
        1.1 +
        Math.abs(Math.sin(i * 2.31)) * 3.1 +
        Math.abs(Math.cos(i * 1.17)) * 2.0;
      const w = 0.55 + (i % 3) * 0.28;
      const d = 0.65 + ((i + 1) % 2) * 0.3;
      const z = -7.8 - (i % 4) * 0.75;
      const meta: BuildingMeta = {
        baseX: -16 + i * spacing,
        w,
        h,
        d,
        z,
        colorHex: palette[i % palette.length]!,
      };
      this.buildingMeta.push(meta);

      _tmpMatrix.makeScale(meta.w, meta.h, meta.d);
      _tmpMatrix.setPosition(meta.baseX, meta.h / 2, meta.z);
      this.buildingInstanced.setMatrixAt(i, _tmpMatrix);
      this.buildingInstanced.setColorAt(i, _tmpColor.setHex(meta.colorHex));
    }
    this.buildingInstanced.instanceMatrix.needsUpdate = true;
    if (this.buildingInstanced.instanceColor) {
      this.buildingInstanced.instanceColor.needsUpdate = true;
    }
  }

  // ── ROAD & SIDEWALK PROPS ───────────────────────────────────────────────

  private buildRoad(): void {
    // Rich asphalt texture via CanvasTexture
    const roadTex = this.cachedTexture("road-asphalt", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#2b2c33";
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 900; i++) {
          const x = (i * 73) % 256;
          const y = (i * 137) % 256;
          ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.08)";
          ctx.fillRect(x, y, 2, 2);
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(14, 3);
      return tex;
    });

    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_Z_MAX - ROAD_Z_MIN);
    const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
    this.roadPlane = new THREE.Mesh(roadGeo, roadMat);
    this.roadPlane.rotation.x = -Math.PI / 2;
    this.roadPlane.position.set(1, 0, 0);
    this.roadPlane.receiveShadow = this.q.shadowsEnabled;
    this.roadGroup.add(this.roadPlane);

    // Sidewalks
    const swGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.16, 1.2);
    const swMat = new THREE.MeshLambertMaterial({ color: 0x52525b });
    const swTop = new THREE.Mesh(swGeo, swMat);
    swTop.position.set(1, 0.08, ROAD_Z_MIN - 0.65);
    swTop.receiveShadow = this.q.shadowsEnabled;
    this.roadGroup.add(swTop);

    const swBottom = new THREE.Mesh(swGeo, swMat);
    swBottom.position.set(1, 0.08, ROAD_Z_MAX + 0.65);
    swBottom.receiveShadow = this.q.shadowsEnabled;
    this.roadGroup.add(swBottom);

    // Alternating black & gold Pedal Code Army curb texture
    const curbTex = this.cachedTexture("curb-stripes", () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 16;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(0, 0, 64, 16);
        ctx.fillStyle = "#18181b";
        ctx.fillRect(64, 0, 64, 16);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.repeat.set(18, 1);
      return tex;
    });

    const curbGeo = new THREE.BoxGeometry(ROAD_WIDTH, 0.12, 0.16);
    const curbMat = new THREE.MeshLambertMaterial({ map: curbTex });
    const curbTop = new THREE.Mesh(curbGeo, curbMat);
    curbTop.position.set(1, 0.06, ROAD_Z_MIN - 0.06);
    this.roadGroup.add(curbTop);

    const curbBottom = new THREE.Mesh(curbGeo, curbMat);
    curbBottom.position.set(1, 0.06, ROAD_Z_MAX + 0.06);
    this.roadGroup.add(curbBottom);

    // Crisp lane dashes
    const dashGeo = new THREE.BoxGeometry(0.95, 0.02, 0.08);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xe5e7eb });
    this.laneDashInstanced = new THREE.InstancedMesh(
      dashGeo,
      dashMat,
      this.laneDashCount,
    );
    this.roadGroup.add(this.laneDashInstanced);

    for (let i = 0; i < this.laneDashCount; i++) {
      _tmpMatrix.identity();
      _tmpMatrix.setPosition(0, -10, 0);
      this.laneDashInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.laneDashInstanced.instanceMatrix.needsUpdate = true;
  }

  private buildStreetProps(): void {
    const count = this.q.streetPropCount;
    const poleGeo = this.cachedGeo("lamp-pole", () =>
      new THREE.CylinderGeometry(0.05, 0.06, 2.8, 6),
    );
    const poleMat = this.cachedMat("lamp-pole-mat", () =>
      new THREE.MeshLambertMaterial({ color: 0x3f3f46 }),
    );
    const bulbGeo = this.cachedGeo("lamp-bulb", () =>
      new THREE.SphereGeometry(0.14, 6, 6),
    );
    const bulbMat = this.cachedMat("lamp-bulb-mat", () =>
      new THREE.MeshBasicMaterial({ color: 0xfef08a }),
    );
    const trunkGeo = this.cachedGeo("palm-trunk", () =>
      new THREE.CylinderGeometry(0.08, 0.14, 2.7, 6),
    );
    const trunkMat = this.cachedMat("palm-trunk-mat", () =>
      new THREE.MeshLambertMaterial({ color: 0x785032 }),
    );
    const frondGeo = this.cachedGeo("palm-frond", () =>
      new THREE.ConeGeometry(0.32, 1.1, 4),
    );
    const frondMat = this.cachedMat("palm-frond-mat", () =>
      new THREE.MeshLambertMaterial({ color: 0x16a34a }),
    );

    const span = 34;
    this.streetProps = [];

    for (let i = 0; i < count; i++) {
      const side: -1 | 1 = i % 2 === 0 ? -1 : 1;
      const isPalm = i % 3 === 1;
      const group = new THREE.Group();

      if (isPalm) {
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.35;
        trunk.rotation.z = side * 0.08;
        group.add(trunk);

        for (let f = 0; f < 5; f++) {
          const angle = (f / 5) * Math.PI * 2;
          const frond = new THREE.Mesh(frondGeo, frondMat);
          frond.position.set(
            Math.cos(angle) * 0.45,
            2.65,
            Math.sin(angle) * 0.45,
          );
          frond.rotation.z = -Math.cos(angle) * 1.1;
          frond.rotation.x = Math.sin(angle) * 1.1;
          group.add(frond);
        }
      } else {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.4;
        group.add(pole);

        const arm = new THREE.Mesh(
          this.cachedGeo("lamp-arm", () => new THREE.BoxGeometry(0.08, 0.08, 0.65)),
          poleMat,
        );
        arm.position.set(0, 2.72, -side * 0.28);
        group.add(arm);

        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(0, 2.65, -side * 0.55);
        group.add(bulb);
      }

      const offset = (i / count) * span;
      const z = side === -1 ? ROAD_Z_MIN - 0.95 : ROAD_Z_MAX + 0.95;
      group.position.set(-14 + offset, 0.14, z);
      this.propGroup.add(group);
      this.streetProps.push({ group, offset, side });
    }
  }

  // ── MOPED (4 DISTINCT LOW-POLY SILHOUETTES) ─────────────────────────────

  private buildMoped(make: MopedMake): void {
    this.currentMake = make;
    while (this.mopedGroup.children.length > 0) {
      const child = this.mopedGroup.children[0]!;
      this.mopedGroup.remove(child);
      child.traverse((obj) => {
        disposeMeshObj(obj);
      });
    }

    const colors = MOPED_COLORS[make];
    const stats = getMopedStats(make);
    const wheelRadius = 0.36;
    const d = this.q.geoDetail;
    const shadows = this.q.shadowsEnabled;

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.75,
      metalness: 0.15,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      roughness: 0.25,
      metalness: 0.85,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: colors.frame,
      roughness: 0.22,
      metalness: 0.72,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: colors.accent,
      roughness: 0.28,
      metalness: 0.55,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.15,
      metalness: 0.92,
    });

    const buildWheel = (xPos: number): THREE.Group => {
      const wg = new THREE.Group();
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius, 0.085, seg(8, d), seg(14, d)),
        tireMat,
      );
      tire.castShadow = shadows;
      wg.add(tire);

      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius - 0.07, 0.03, seg(6, d), seg(12, d)),
        rimMat,
      );
      wg.add(rim);

      // Cross spokes so wheel spin is unmistakably visible!
      const spokeGeo = new THREE.BoxGeometry(wheelRadius * 1.75, 0.03, 0.03);
      const s1 = new THREE.Mesh(spokeGeo, rimMat);
      const s2 = new THREE.Mesh(spokeGeo, rimMat);
      s2.rotation.z = Math.PI / 2;
      wg.add(s1, s2);

      const hub = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.14, seg(8, d)),
        chromeMat,
      );
      hub.rotation.x = Math.PI / 2;
      wg.add(hub);

      wg.position.set(xPos, wheelRadius, 0);
      return wg;
    };

    const rearWheel = buildWheel(-0.62);
    const frontWheel = buildWheel(0.66);
    this.mopedGroup.add(rearWheel, frontWheel);

    // Frame geometry tailored to each moped's real silhouette
    const frameGroup = new THREE.Group();

    // Rear swingarm + lower cradle
    const swingArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.75, 0.07, 0.14),
      frameMat,
    );
    swingArm.position.set(-0.28, wheelRadius + 0.08, 0);
    frameGroup.add(swingArm);

    // Front forks (dual chrome tubes)
    const forkGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.72, seg(6, d));
    for (const fz of [-0.09, 0.09]) {
      const fork = new THREE.Mesh(forkGeo, chromeMat);
      fork.rotation.z = 0.26;
      fork.position.set(0.56, wheelRadius + 0.34, fz);
      frameGroup.add(fork);
    }

    // Handlebars + rubber grips
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.56, seg(6, d)),
      chromeMat,
    );
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0.42, wheelRadius + 0.74, 0);
    frameGroup.add(bar);

    const gripGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.13, seg(6, d));
    for (const gz of [-0.24, 0.24]) {
      const grip = new THREE.Mesh(gripGeo, tireMat);
      grip.rotation.x = Math.PI / 2;
      grip.position.set(0.42, wheelRadius + 0.74, gz);
      frameGroup.add(grip);
    }

    // Fenders
    const rearFender = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.05, 0.19),
      accentMat,
    );
    rearFender.position.set(-0.66, wheelRadius + 0.44, 0);
    rearFender.rotation.z = 0.25;
    frameGroup.add(rearFender);

    const frontFender = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.05, 0.18),
      accentMat,
    );
    frontFender.position.set(0.68, wheelRadius + 0.42, 0);
    frontFender.rotation.z = -0.25;
    frameGroup.add(frontFender);

    if (stats.frameStyle === "step-through") {
      // Puch Maxi classic slanted step-through mono-tube
      const mainBeam = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.12, 0.13),
        frameMat,
      );
      mainBeam.rotation.z = 0.32;
      mainBeam.position.set(0.06, wheelRadius + 0.36, 0);
      frameGroup.add(mainBeam);

      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 0.04, 0.15),
        accentMat,
      );
      stripe.rotation.z = 0.32;
      stripe.position.set(0.06, wheelRadius + 0.38, 0);
      frameGroup.add(stripe);
    } else if (stats.frameStyle === "top-bar") {
      // Honda Hobbit PA50 with signature horizontal tank & front rack
      const topTank = new THREE.Mesh(
        new THREE.BoxGeometry(0.74, 0.18, 0.2),
        frameMat,
      );
      topTank.position.set(0.14, wheelRadius + 0.56, 0);
      frameGroup.add(topTank);

      const badge = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.06, 0.22),
        accentMat,
      );
      badge.position.set(0.14, wheelRadius + 0.56, 0);
      frameGroup.add(badge);
    } else if (stats.frameStyle === "sport") {
      // Derbi Variant sporty top tank + racing front fairing
      const sportTank = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.2, 0.22),
        frameMat,
      );
      sportTank.rotation.z = -0.1;
      sportTank.position.set(0.12, wheelRadius + 0.54, 0);
      frameGroup.add(sportTank);

      const fairing = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.34, 0.28),
        accentMat,
      );
      fairing.rotation.z = -0.35;
      fairing.position.set(0.6, wheelRadius + 0.66, 0);
      frameGroup.add(fairing);
    } else {
      // Tomos A35 sturdy tubular frame + steel rear luggage rack
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(1.02, 0.15, 0.16),
        frameMat,
      );
      beam.rotation.z = 0.22;
      beam.position.set(0.05, wheelRadius + 0.42, 0);
      frameGroup.add(beam);

      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.05, 0.26),
        chromeMat,
      );
      rack.position.set(-0.74, wheelRadius + 0.62, 0);
      frameGroup.add(rack);
    }

    // Seat post & cushioned banana seat
    const seatTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.52, seg(6, d)),
      frameMat,
    );
    seatTube.position.set(-0.28, wheelRadius + 0.46, 0);
    frameGroup.add(seatTube);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.11, 0.25),
      new THREE.MeshLambertMaterial({ color: colors.seat }),
    );
    seat.position.set(-0.32, wheelRadius + 0.74, 0);
    frameGroup.add(seat);

    // Finned 2-stroke engine block
    const engine = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.26, 0.22),
      new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        roughness: 0.4,
        metalness: 0.65,
      }),
    );
    engine.position.set(-0.08, wheelRadius + 0.08, 0);
    frameGroup.add(engine);

    // Chrome expansion chamber exhaust pipe
    const chamber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.04, 0.58, seg(8, d)),
      chromeMat,
    );
    chamber.rotation.z = Math.PI / 2 - 0.14;
    chamber.position.set(-0.56, wheelRadius + 0.16, 0.16);
    frameGroup.add(chamber);

    const stinger = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.035, 0.24, seg(6, d)),
      chromeMat,
    );
    stinger.rotation.z = Math.PI / 2 - 0.25;
    stinger.position.set(-0.92, wheelRadius + 0.24, 0.16);
    frameGroup.add(stinger);

    // Headlight bucket + bright lens + road beam cone
    const hlBucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.09, 0.14, seg(8, d)),
      tireMat,
    );
    hlBucket.rotation.z = Math.PI / 2;
    hlBucket.position.set(0.64, wheelRadius + 0.6, 0);
    frameGroup.add(hlBucket);

    const hlLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, seg(8, d), seg(8, d)),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfde68a,
        emissiveIntensity: 2.2,
      }),
    );
    hlLens.position.set(0.71, wheelRadius + 0.6, 0);
    frameGroup.add(hlLens);

    const beamGeo = new THREE.ConeGeometry(0.65, 2.8, 8, 1, true);
    beamGeo.rotateZ(Math.PI / 2 + 0.16);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const headlightBeam = new THREE.Mesh(beamGeo, beamMat);
    headlightBeam.position.set(2.05, wheelRadius + 0.34, 0);
    frameGroup.add(headlightBeam);

    // Glowing taillight
    const taillight = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.1, 0.14),
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 2,
      }),
    );
    taillight.position.set(-0.84, wheelRadius + 0.56, 0);
    frameGroup.add(taillight);

    this.mopedGroup.add(frameGroup);

    // Articulated Rider (hoodie, backpack, both arms & legs, helmet + visor)
    const riderGroup = new THREE.Group();
    const jacketMat = new THREE.MeshLambertMaterial({ color: colors.jacket });
    const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1e3a5f });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xfef08a });

    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.46, 0.28),
      jacketMat,
    );
    torso.rotation.z = -0.18;
    torso.position.set(-0.22, wheelRadius + 1.04, 0);
    riderGroup.add(torso);

    // Yellow Pedal Code Army backpack!
    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.34, 0.24),
      new THREE.MeshLambertMaterial({ color: 0xffd700 }),
    );
    backpack.rotation.z = -0.18;
    backpack.position.set(-0.38, wheelRadius + 1.06, 0);
    riderGroup.add(backpack);

    // Helmet + glossy dark visor
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, seg(10, d), seg(10, d)),
      accentMat,
    );
    helmet.position.set(-0.14, wheelRadius + 1.44, 0);
    riderGroup.add(helmet);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.1, 0.24),
      new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.1,
        metalness: 0.9,
      }),
    );
    visor.position.set(-0.01, wheelRadius + 1.45, 0);
    riderGroup.add(visor);

    // Both arms reaching forward to handlebars
    const armGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.56, seg(6, d));
    for (const az of [-0.18, 0.18]) {
      const arm = new THREE.Mesh(armGeo, jacketMat);
      arm.rotation.z = Math.PI / 2 + 0.36;
      arm.position.set(0.12, wheelRadius + 0.95, az);
      riderGroup.add(arm);
    }

    // Both legs + skate shoes on pedals
    const legGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.46, seg(6, d));
    const shoeGeo = new THREE.BoxGeometry(0.16, 0.08, 0.1);
    for (const lz of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(legGeo, jeansMat);
      leg.rotation.z = 0.42;
      leg.position.set(-0.24, wheelRadius + 0.58, lz);
      riderGroup.add(leg);

      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(-0.1, wheelRadius + 0.34, lz);
      riderGroup.add(shoe);
    }

    this.mopedGroup.add(riderGroup);

    // Magnet active cyan halo ring around moped
    const magnetHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.12, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    magnetHalo.rotation.x = -Math.PI / 2;
    magnetHalo.position.set(0, 0.04, 0);
    magnetHalo.visible = false;
    this.mopedGroup.add(magnetHalo);

    this.mopedParts = {
      rearWheel,
      frontWheel,
      rider: riderGroup,
      headlightBeam,
      magnetHalo,
    };

    if (shadows) {
      this.mopedGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj !== headlightBeam && obj !== magnetHalo) {
          obj.castShadow = true;
        }
      });
    }
  }

  // ── PARTICLES ───────────────────────────────────────────────────────────

  private buildParticles(): void {
    const d = this.q.geoDetail;

    const sphereGeo = new THREE.SphereGeometry(0.06, seg(5, d), seg(5, d));
    const exhaustMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.52,
    });
    this.exhaustInstanced = new THREE.InstancedMesh(
      sphereGeo,
      exhaustMat,
      this.q.maxExhaust,
    );
    this.exhaustInstanced.castShadow = false;
    this.exhaustInstanced.frustumCulled = false;
    this.exhaustInstanced.count = 0;
    this.particleGroup.add(this.exhaustInstanced);

    const starGeo = new THREE.OctahedronGeometry(0.08, 0);
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    this.sparkleInstanced = new THREE.InstancedMesh(
      starGeo,
      sparkleMat,
      this.q.maxSparkles,
    );
    this.sparkleInstanced.castShadow = false;
    this.sparkleInstanced.frustumCulled = false;
    this.sparkleInstanced.count = 0;
    this.particleGroup.add(this.sparkleInstanced);

    const lineGeo = new THREE.BoxGeometry(1.2, 0.015, 0.015);
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
    });
    this.speedLineInstanced = new THREE.InstancedMesh(
      lineGeo,
      lineMat,
      this.q.maxSpeedLines,
    );
    this.speedLineInstanced.castShadow = false;
    this.speedLineInstanced.frustumCulled = false;
    this.speedLineInstanced.count = 0;
    this.particleGroup.add(this.speedLineInstanced);
  }

  // ── HIT FLASH ───────────────────────────────────────────────────────────

  private buildHitFlash(): void {
    const geo = new THREE.PlaneGeometry(100, 100);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff2020,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
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
    const safeW = Math.max(w, 1);
    const safeH = Math.max(h, 1);
    this.webglRenderer.setSize(safeW, safeH);
    if (this.composer) this.composer.setSize(safeW, safeH);

    this.currentAspect = safeW / safeH;
    this.updateCameraProjection();

    if (this.bloomPass) {
      const bw = Math.round(safeW * this.q.bloomResScale);
      const bh = Math.round(safeH * this.q.bloomResScale);
      this.bloomPass.resolution.set(bw, bh);
    }
  }

  private updateCameraProjection(): void {
    const frustum = getEffectiveFrustum(this.currentAspect);
    this.camera.left = -frustum * this.currentAspect;
    this.camera.right = frustum * this.currentAspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.zoom = this.currentZoom;
    this.camera.updateProjectionMatrix();
  }

  render(state: RenderState, dt: number): void {
    if (!this.initialized) return;
    const isPaused = Boolean(state.paused);
    if (!isPaused) {
      this.frameCount++;
    }

    if (this.currentMake !== state.moped) {
      this.buildMoped(state.moped);
    }

    // Dynamic zone atmosphere & sky color blending
    if (!isPaused) {
      this.updateZoneAtmosphere(state.zoneIndex, dt);
      this.updateShake(state, dt);
      this.updateDynamicZoom(state, dt);
    }

    this.camera.position.set(
      this.baseCameraPos.x + this.shakeOffset.x * 0.04,
      this.baseCameraPos.y + this.shakeOffset.y * 0.04,
      this.baseCameraPos.z,
    );

    if (!isPaused) {
      this.updateClouds(dt);
    }
    this.updateBuildings(state);
    this.updateRoad(state);
    this.updateStreetProps(state);
    this.updateEntities(state, dt);
    this.updateMoped(state);

    if (!isPaused) {
      this.updateParticles(state, dt);
      this.updateSparkles(dt);
      this.updateSpeedLines(state, dt);
    }
    this.updateHitFlash(state);

    if (this.bloomPass) {
      this.updateBloom(state);
    }

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
    this.shakeIntensity = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.frameCount = 0;
    this.lastBuildingScroll = -1;
    this.lastRoadScrollOffset = -1;
    this.currentZoom = 1;

    for (const [, group] of this.entityMeshes) {
      this.entityGroup.remove(group);
      this.recycleEntityGroup(group);
    }
    this.entityMeshes.clear();

    this.exhaustInstanced.count = 0;
    this.sparkleInstanced.count = 0;
    this.speedLineInstanced.count = 0;

    for (const data of this.cloudData) {
      data.x = (Math.random() - 0.5) * 44;
    }
  }

  destroy(): void {
    if (!this.initialized) return;

    this.reset();
    if (this.composer) this.composer.dispose();
    this.webglRenderer.dispose();
    this.webglRenderer.forceContextLoss();
    this.scene.traverse((obj) => {
      disposeMeshObj(obj);
    });

    for (const group of this.entityPool) {
      group.traverse((obj) => {
        disposeMeshObj(obj);
      });
    }
    this.entityPool = [];

    for (const geo of this.sharedGeoCache.values()) {
      geo.dispose();
    }
    this.sharedGeoCache.clear();
    for (const mat of this.sharedMatCache.values()) {
      mat.dispose();
    }
    this.sharedMatCache.clear();
    for (const tex of this.sharedTexCache.values()) {
      tex.dispose();
    }
    this.sharedTexCache.clear();

    if (this.webglRenderer.domElement.parentElement) {
      this.webglRenderer.domElement.parentElement.removeChild(
        this.webglRenderer.domElement,
      );
    }
    this.initialized = false;
  }

  spawnCollectSparkles(worldX: number, lane: number, color = 0xffd700): void {
    const targetZ = laneToZ(lane);
    const count = Math.min(14, this.q.maxSparkles - this.sparkles.length);
    for (let i = 0; i < count; i++) {
      const angle = (i / 14) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 2.2 + Math.random() * 3.2;
      this.sparkles.push({
        x: worldX + (Math.random() - 0.5) * 0.4,
        y: 0.55 + this.currentMopedY + Math.random() * 0.35,
        z: targetZ + (Math.random() - 0.5) * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.abs(Math.sin(angle)) * speed + 2.4,
        vz: (Math.random() - 0.5) * speed,
        life: 0,
        maxLife: 0.42 + Math.random() * 0.28,
        color: i % 2 === 0 ? color : 0xffffff,
      });
    }
  }

  spawnHitSparks(worldX: number, lane: number): void {
    this.shakeIntensity = 9;
    const targetZ = laneToZ(lane);
    const count = Math.min(16, this.q.maxSparkles - this.sparkles.length);
    for (let i = 0; i < count; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 3.2 + Math.random() * 2.8;
      this.sparkles.push({
        x: worldX + (Math.random() - 0.5) * 0.4,
        y: 0.6 + Math.random() * 0.4,
        z: targetZ + (Math.random() - 0.5) * 0.4,
        vx: Math.cos(angle) * speed,
        vy: Math.abs(Math.sin(angle)) * speed + 1.5,
        vz: (Math.random() - 0.5) * speed,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        color: i % 2 === 0 ? 0xff4500 : 0xffd700,
      });
    }
  }

  spawnWheeliePop(lane: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, 2.2);
    const targetZ = laneToZ(lane);
    const count = Math.min(8, this.q.maxExhaust - this.particles.length);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: -0.95 + (Math.random() - 0.5) * 0.2,
        y: 0.3 + Math.random() * 0.2,
        z: targetZ + (Math.random() - 0.5) * 0.25,
        vx: -2.4 - Math.random() * 2.2,
        vy: 0.6 + Math.random() * 1.1,
        vz: (Math.random() - 0.5) * 0.6,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.25,
        size: 0.08 + Math.random() * 0.08,
        color: 0xfef08a,
      });
    }
  }

  // ── ENTITY POOLING ────────────────────────────────────────────────────

  private recycleEntityGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0]!;
      group.remove(child);
      child.traverse((obj) => {
        disposeMeshObj(obj);
      });
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

  private updateZoneAtmosphere(zoneIndex: number, dt: number): void {
    const zone = EAST_BAY_ZONES[zoneIndex] ?? EAST_BAY_ZONES[0]!;
    const alpha = Math.min(1, dt * 1.6);

    const topUniform = this.skyMat.uniforms.uTopColor?.value as
      | THREE.Color
      | undefined;
    const bottomUniform = this.skyMat.uniforms.uBottomColor?.value as
      | THREE.Color
      | undefined;

    if (topUniform) {
      _targetSkyTop.setHex(zone.skyTop);
      topUniform.lerp(_targetSkyTop, alpha);
    }
    if (bottomUniform) {
      _targetSkyBottom.setHex(zone.skyBottom);
      bottomUniform.lerp(_targetSkyBottom, alpha);
    }

    const sunMat = this.sunMesh.material as THREE.MeshBasicMaterial;
    _targetSun.setHex(zone.sunColor);
    sunMat.color.lerp(_targetSun, alpha);
    this.sunLight.color.lerp(_targetSun, alpha);

    _targetHill.setHex(zone.hillColor);
    this.hillMat.color.lerp(_targetHill, alpha);
  }

  private updateDynamicZoom(state: RenderState, dt: number): void {
    const targetZoom = state.speedBoostActive
      ? 0.93
      : state.player.isWheeling
        ? 0.98
        : 1.0;
    const nextZoom =
      this.currentZoom + (targetZoom - this.currentZoom) * Math.min(1, dt * 5);
    if (Math.abs(nextZoom - this.currentZoom) > 0.0005) {
      this.currentZoom = nextZoom;
      this.updateCameraProjection();
    }
  }

  private updateClouds(dt: number): void {
    for (let i = 0; i < this.cloudData.length; i++) {
      const c = this.cloudData[i]!;
      c.x -= c.speed * dt;
      if (c.x < -26) c.x = 26;
      _tmpMatrix.makeScale(c.w, c.h, c.w * 0.6);
      _tmpVec.set(c.x, c.y, c.z);
      _tmpMatrix.setPosition(_tmpVec);
      this.cloudInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.cloudInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateBuildings(state: RenderState): void {
    const bc = this.buildingMeta.length;
    const scrollOffset = state.distance * 0.00055;
    const snapped = Math.round(scrollOffset * 100);
    if (snapped === this.lastBuildingScroll) return;
    this.lastBuildingScroll = snapped;

    const totalSpan = 36;
    for (let i = 0; i < bc; i++) {
      const m = this.buildingMeta[i]!;
      let bx = ((m.baseX - scrollOffset + 18) % totalSpan);
      if (bx < 0) bx += totalSpan;
      bx -= 18;
      _tmpMatrix.makeScale(m.w, m.h, m.d);
      _tmpVec.set(bx, m.h / 2, m.z);
      _tmpMatrix.setPosition(_tmpVec);
      this.buildingInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.buildingInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateRoad(state: RenderState): void {
    const scrollOffset = (state.distance * WORLD_SCALE) % 3;
    if (scrollOffset === this.lastRoadScrollOffset) return;
    this.lastRoadScrollOffset = scrollOffset;

    // Scroll asphalt & curb UV maps smoothly
    const roadMat = this.roadPlane.material as THREE.MeshLambertMaterial;
    if (roadMat.map) {
      roadMat.map.offset.x = (state.distance * WORLD_SCALE * 0.42) % 1;
    }

    let dashIdx = 0;
    for (let laneDiv = 1; laneDiv <= 2; laneDiv++) {
      const z =
        LANE_POSITIONS[laneDiv - 1]! +
        (LANE_POSITIONS[laneDiv]! - LANE_POSITIONS[laneDiv - 1]!) / 2;
      for (let i = 0; i < 22 && dashIdx < this.laneDashCount; i++) {
        const x = -ROAD_WIDTH / 2 + i * 1.6 - scrollOffset;
        _tmpMatrix.identity();
        _tmpVec.set(x, 0.015, z);
        _tmpMatrix.setPosition(_tmpVec);
        this.laneDashInstanced.setMatrixAt(dashIdx, _tmpMatrix);
        dashIdx++;
      }
    }
    this.laneDashInstanced.count = dashIdx;
    this.laneDashInstanced.instanceMatrix.needsUpdate = true;
  }

  private updateStreetProps(state: RenderState): void {
    const span = 34;
    const scroll = state.distance * WORLD_SCALE;
    for (const prop of this.streetProps) {
      let x = (prop.offset - scroll) % span;
      if (x < 0) x += span;
      prop.group.position.x = x - 14;
    }
  }

  private updateEntities(state: RenderState, dt: number): void {
    const activeIds = new Set<number>();
    const isPaused = Boolean(state.paused);

    for (const entity of state.entities) {
      if (!entity.active || entity.collected) continue;
      if (entity.x > VIRTUAL_WIDTH + 80 || entity.x + entity.width < -70) continue;

      activeIds.add(entity.id);
      const worldX = entityToWorldX(entity.x + entity.width / 2);
      const targetZ = laneToZ(entity.lane);

      let group = this.entityMeshes.get(entity.id);
      if (!group) {
        group = this.getPooledGroup();
        this.buildEntityMesh(group, entity);
        this.entityMeshes.set(entity.id, group);
        this.entityGroup.add(group);
        group.position.set(worldX, 0, targetZ);
      } else {
        group.position.x = worldX;
        group.position.y = 0;
        if (!isPaused) {
          const lerpAlpha = 1 - Math.exp(-14 * dt);
          group.position.z += (targetZ - group.position.z) * lerpAlpha;
          if (Math.abs(targetZ - group.position.z) < 0.001) {
            group.position.z = targetZ;
          }
        }
      }

      group.visible = true;

      if (entity.type === "collectible") {
        group.rotation.y = this.frameCount * 0.055 + entity.id;
        group.position.y =
          0.38 + Math.sin(this.frameCount * 0.09 + entity.id) * 0.16;
      }

      if (entity.type === "obstacle" && entity.subType === "car") {
        // Subtle suspension bounce for moving traffic
        group.position.y = Math.sin(this.frameCount * 0.25 + entity.id) * 0.02;
      }

      if (entity.type === "obstacle" && entity.subType === "dog") {
        group.position.y = Math.abs(Math.sin(this.frameCount * 0.2 + entity.id)) * 0.09;
      }

      if (!isPaused && entity.type === "obstacle" && entity.subType === "oil-slick") {
        const mesh = group.children[0] as THREE.Mesh | undefined;
        if (mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
          const hue = (this.frameCount * 0.012 + entity.id * 0.17) % 1;
          mesh.material.color.setHSL(hue, 0.75, 0.22);
        }
      }
    }

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
        const variant = entity.carVariant ?? "sedan";
        const bodyW = entity.width * WORLD_SCALE;
        const bodyH = variant === "van" ? 0.68 : 0.48;
        const bodyD = entity.height * WORLD_SCALE * 0.94;

        const bodyGeo = this.cachedGeo("car-body", () => new THREE.BoxGeometry(1, 1, 1));
        const bodyMat = new THREE.MeshLambertMaterial({ color: palette.body });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(bodyW, bodyH, bodyD);
        body.position.y = bodyH / 2 + 0.14;
        body.castShadow = shadows;
        body.receiveShadow = shadows;
        group.add(body);

        // Cabin / roof tailored by vehicle variant
        const roofMat = new THREE.MeshLambertMaterial({ color: palette.roof });
        const roof = new THREE.Mesh(bodyGeo, roofMat);
        const roofW =
          variant === "van"
            ? bodyW * 0.84
            : variant === "hatchback"
              ? bodyW * 0.62
              : bodyW * 0.48;
        const roofH = variant === "van" ? 0.36 : 0.32;
        const roofX = variant === "van" ? -bodyW * 0.04 : -bodyW * 0.05;
        roof.scale.set(roofW, roofH, bodyD * 0.84);
        roof.position.set(roofX, bodyH + roofH / 2 + 0.11, 0);
        roof.castShadow = shadows;
        group.add(roof);

        // Tinted windows band
        const winMat = this.cachedMat("car-win-mat", () =>
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.15,
            metalness: 0.8,
          }),
        );
        const winBand = new THREE.Mesh(bodyGeo, winMat);
        winBand.scale.set(roofW + 0.04, roofH * 0.62, bodyD * 0.87);
        winBand.position.set(roofX, bodyH + roofH * 0.48 + 0.11, 0);
        group.add(winBand);

        // Bumpers
        const bumperMat = this.cachedMat("car-bumper-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x27272a }),
        );
        for (const bx of [-bodyW / 2 - 0.03, bodyW / 2 + 0.03]) {
          const bumper = new THREE.Mesh(bodyGeo, bumperMat);
          bumper.scale.set(0.08, 0.14, bodyD * 0.96);
          bumper.position.set(bx, 0.22, 0);
          group.add(bumper);
        }

        // Bright front headlights (facing right, driving same direction as player!)
        const hlGeo = this.cachedGeo("car-hl", () =>
          new THREE.BoxGeometry(0.06, 0.11, 0.18),
        );
        const hlMat = this.cachedMat("car-hl-mat", () =>
          new THREE.MeshBasicMaterial({ color: 0xfef3c7 }),
        );
        for (const zSign of [-1, 1]) {
          const hl = new THREE.Mesh(hlGeo, hlMat);
          hl.position.set(bodyW / 2 + 0.01, 0.38, zSign * bodyD * 0.31);
          group.add(hl);
        }

        // Glowing red brake taillights facing player (left side of car)
        const tlMat = this.cachedMat("car-tl-mat", () =>
          new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
        );
        for (const zSign of [-1, 1]) {
          const tl = new THREE.Mesh(hlGeo, tlMat);
          tl.position.set(-bodyW / 2 - 0.01, 0.4, zSign * bodyD * 0.32);
          group.add(tl);
        }

        // Wheels
        const wGeo = this.cachedGeo("car-wheel", () => {
          const g = new THREE.CylinderGeometry(0.17, 0.17, 1, seg(8, d));
          g.rotateX(Math.PI / 2);
          return g;
        });
        const wMat = this.cachedMat("car-wheel-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x111827 }),
        );
        for (const wx of [bodyW * 0.32, -bodyW * 0.32]) {
          const w = new THREE.Mesh(wGeo, wMat);
          w.scale.set(1, 1, bodyD + 0.08);
          w.position.set(wx, 0.17, 0);
          group.add(w);
        }
        break;
      }

      case "pothole": {
        const r = (entity.width * WORLD_SCALE) / 2;
        // Caution yellow cracked asphalt rim for instant readability
        const rimGeo = this.cachedGeo("pothole-rim", () =>
          new THREE.RingGeometry(0.46, 0.62, seg(10, d)),
        );
        const rimMat = this.cachedMat("pothole-rim-mat", () =>
          new THREE.MeshBasicMaterial({
            color: 0xfacc15,
            transparent: true,
            opacity: 0.72,
            side: THREE.DoubleSide,
          }),
        );
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = -Math.PI / 2;
        rim.scale.set(r * 2.1, r * 1.9, 1);
        rim.position.y = 0.025;
        group.add(rim);

        const holeGeo = this.cachedGeo("pothole", () =>
          new THREE.CylinderGeometry(0.5, 0.42, 0.08, seg(10, d)),
        );
        const holeMat = this.cachedMat("pothole-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x09090b }),
        );
        const mesh = new THREE.Mesh(holeGeo, holeMat);
        mesh.scale.set(r * 2, 1, r * 1.85);
        mesh.position.y = -0.015;
        group.add(mesh);
        break;
      }

      case "oil-slick": {
        const r = (entity.width * WORLD_SCALE) / 2;
        const geo = this.cachedGeo("oil", () =>
          new THREE.CylinderGeometry(0.5, 0.5, 0.02, seg(12, d)),
        );
        const mat = new THREE.MeshStandardMaterial({
          color: 0x22223b,
          roughness: 0.08,
          metalness: 0.92,
        });
        const mainLobe = new THREE.Mesh(geo, mat);
        mainLobe.scale.set(r * 2, 1, r * 1.45);
        mainLobe.position.y = 0.015;
        group.add(mainLobe);

        const sideLobe = new THREE.Mesh(geo, mat);
        sideLobe.scale.set(r * 1.2, 1, r * 0.95);
        sideLobe.position.set(r * 0.45, 0.014, r * 0.28);
        group.add(sideLobe);
        break;
      }

      case "traffic-cone": {
        const coneH = entity.height * WORLD_SCALE;
        const coneR = (entity.width * WORLD_SCALE) / 2;
        const coneGeo = this.cachedGeo("cone", () =>
          new THREE.ConeGeometry(1, 1, seg(8, d)),
        );
        const coneMat = this.cachedMat("cone-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0xf97316 }),
        );
        const mesh = new THREE.Mesh(coneGeo, coneMat);
        mesh.scale.set(coneR * 1.15, coneH, coneR * 1.15);
        mesh.position.y = coneH / 2 + 0.04;
        mesh.castShadow = shadows;
        group.add(mesh);

        // Reflective white safety stripes
        const stripeGeo = this.cachedGeo("cone-stripe", () =>
          new THREE.CylinderGeometry(0.54, 0.68, 0.18, seg(8, d)),
        );
        const stripeMat = this.cachedMat("cone-stripe-mat", () =>
          new THREE.MeshBasicMaterial({ color: 0xf8fafc }),
        );
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.scale.set(coneR * 1.18, coneH * 0.9, coneR * 1.18);
        stripe.position.y = coneH * 0.56;
        group.add(stripe);

        const baseGeo = this.cachedGeo("cone-base", () =>
          new THREE.BoxGeometry(1, 0.07, 1),
        );
        const baseMat = this.cachedMat("cone-base-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x18181b }),
        );
        const base = new THREE.Mesh(baseGeo, baseMat);
        const bScale = entity.width * WORLD_SCALE * 1.45;
        base.scale.set(bScale, 1, bScale);
        base.position.y = 0.035;
        group.add(base);
        break;
      }

      case "dog": {
        const furMat = this.cachedMat("dog-body-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0xb47b47 }),
        );
        const darkMat = this.cachedMat("dog-dark-mat", () =>
          new THREE.MeshLambertMaterial({ color: 0x6b4226 }),
        );
        const collarMat = this.cachedMat("dog-collar-mat", () =>
          new THREE.MeshBasicMaterial({ color: 0xef4444 }),
        );

        const body = new THREE.Mesh(
          this.cachedGeo("dog-body", () => new THREE.BoxGeometry(0.62, 0.28, 0.3)),
          furMat,
        );
        body.position.y = 0.36;
        body.castShadow = shadows;
        group.add(body);

        const collar = new THREE.Mesh(
          this.cachedGeo("dog-collar", () => new THREE.BoxGeometry(0.08, 0.26, 0.32)),
          collarMat,
        );
        collar.position.set(0.24, 0.39, 0);
        group.add(collar);

        const head = new THREE.Mesh(
          this.cachedGeo("dog-head", () => new THREE.BoxGeometry(0.24, 0.22, 0.24)),
          furMat,
        );
        head.position.set(0.36, 0.5, 0);
        group.add(head);

        const snout = new THREE.Mesh(
          this.cachedGeo("dog-snout", () => new THREE.BoxGeometry(0.14, 0.1, 0.14)),
          darkMat,
        );
        snout.position.set(0.5, 0.46, 0);
        group.add(snout);

        // Floppy ears + tail
        const earGeo = this.cachedGeo("dog-ear", () => new THREE.BoxGeometry(0.08, 0.16, 0.06));
        for (const ez of [-0.14, 0.14]) {
          const ear = new THREE.Mesh(earGeo, darkMat);
          ear.position.set(0.32, 0.48, ez);
          group.add(ear);
        }

        const tail = new THREE.Mesh(
          this.cachedGeo("dog-tail", () => new THREE.CylinderGeometry(0.03, 0.04, 0.26, 5)),
          furMat,
        );
        tail.rotation.z = 0.65;
        tail.position.set(-0.36, 0.52, 0);
        group.add(tail);

        const legGeo = this.cachedGeo("dog-leg", () =>
          new THREE.CylinderGeometry(0.04, 0.035, 0.24, 5),
        );
        const legPositions: [number, number, number][] = [
          [0.2, 0.12, 0.11],
          [0.2, 0.12, -0.11],
          [-0.2, 0.12, 0.11],
          [-0.2, 0.12, -0.11],
        ];
        for (const [lx, ly, lz] of legPositions) {
          const leg = new THREE.Mesh(legGeo, darkMat);
          leg.position.set(lx, ly, lz);
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
        const ceramic = new THREE.Mesh(
          this.cachedGeo("sp-ceramic", () =>
            new THREE.CylinderGeometry(0.085, 0.085, 0.26, seg(8, d)),
          ),
          this.cachedMat("sp-ceramic-mat", () =>
            new THREE.MeshStandardMaterial({
              color: 0xffffff,
              emissive: 0x38bdf8,
              emissiveIntensity: 0.65,
              roughness: 0.2,
            }),
          ),
        );
        ceramic.position.y = 0.34;
        group.add(ceramic);

        const hex = new THREE.Mesh(
          this.cachedGeo("sp-hex", () => new THREE.CylinderGeometry(0.13, 0.13, 0.14, 6)),
          this.cachedMat("sp-hex-mat", () =>
            new THREE.MeshStandardMaterial({
              color: 0xe5e7eb,
              emissive: 0xffd700,
              emissiveIntensity: 0.5,
              roughness: 0.2,
              metalness: 0.85,
            }),
          ),
        );
        hex.position.y = 0.16;
        group.add(hex);

        const tip = new THREE.Mesh(
          this.cachedGeo("sp-tip", () => new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6)),
          this.cachedMat("sp-tip-mat", () =>
            new THREE.MeshBasicMaterial({ color: 0xffd700 }),
          ),
        );
        tip.position.y = 0.04;
        group.add(tip);
        break;
      }

      case "jet": {
        const brassMat = this.cachedMat("jet-mat", () =>
          new THREE.MeshStandardMaterial({
            color: 0xf59e0b,
            emissive: 0xffd700,
            emissiveIntensity: 1.1,
            roughness: 0.22,
            metalness: 0.8,
          }),
        );
        const body = new THREE.Mesh(
          this.cachedGeo("jet-hex", () => new THREE.CylinderGeometry(0.2, 0.2, 0.26, 6)),
          brassMat,
        );
        body.position.y = 0.24;
        group.add(body);

        const cap = new THREE.Mesh(
          this.cachedGeo("jet-cap", () => new THREE.CylinderGeometry(0.11, 0.16, 0.16, 8)),
          brassMat,
        );
        cap.position.y = 0.42;
        group.add(cap);
        break;
      }

      case "pipe": {
        const pipeMat = this.cachedMat("pipe-mat", () =>
          new THREE.MeshStandardMaterial({
            color: 0xd4d4d8,
            emissive: 0xfbbf24,
            emissiveIntensity: 0.85,
            roughness: 0.18,
            metalness: 0.9,
          }),
        );
        const cone1 = new THREE.Mesh(
          this.cachedGeo("pipe-c1", () => new THREE.ConeGeometry(0.15, 0.42, seg(8, d))),
          pipeMat,
        );
        cone1.rotation.z = -Math.PI / 2;
        cone1.position.set(-0.2, 0.24, 0);
        group.add(cone1);

        const cone2 = new THREE.Mesh(
          this.cachedGeo("pipe-c2", () => new THREE.ConeGeometry(0.15, 0.36, seg(8, d))),
          pipeMat,
        );
        cone2.rotation.z = Math.PI / 2;
        cone2.position.set(0.18, 0.24, 0);
        group.add(cone2);
        break;
      }

      case "cylinder": {
        const cylMat = this.cachedMat("cyl-mat", () =>
          new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 1.6,
            roughness: 0.2,
            metalness: 0.8,
          }),
        );
        const barrel = new THREE.Mesh(
          this.cachedGeo("cyl", () =>
            new THREE.CylinderGeometry(0.17, 0.17, 0.52, seg(10, d)),
          ),
          cylMat,
        );
        barrel.position.y = 0.28;
        group.add(barrel);

        const finGeo = this.cachedGeo("cyl-fin", () =>
          new THREE.BoxGeometry(0.42, 0.035, 0.42),
        );
        for (let i = 0; i < 3; i++) {
          const fin = new THREE.Mesh(finGeo, cylMat);
          fin.position.y = 0.14 + i * 0.14;
          group.add(fin);
        }
        break;
      }
    }
  }

  private getShopSignTexture(shopKey: string): THREE.Texture {
    return this.cachedTexture(`shop-sign-${shopKey}`, () => {
      const brand = SHOP_BRANDS[shopKey] ?? {
        bg: 0x333333,
        trim: 0xffd700,
        bannerHex: "#111111",
        borderHex: "#FFD700",
        text: "SHOP",
        perk: "BONUS",
      };
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 160;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = brand.bannerHex;
        ctx.fillRect(0, 0, 512, 160);
        ctx.strokeStyle = brand.borderHex;
        ctx.lineWidth = 14;
        ctx.strokeRect(7, 7, 498, 146);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 58px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(brand.text, 256, 62);

        ctx.fillStyle = brand.borderHex;
        ctx.font = "800 32px sans-serif";
        ctx.fillText(brand.perk, 256, 120);
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      return tex;
    });
  }

  /**
   * Shops are glowing overhead pit-stop gantry arches you ride THROUGH!
   */
  private buildShopMesh(group: THREE.Group, entity: GameEntity): void {
    const brand = SHOP_BRANDS[entity.subType] ?? {
      bg: 0x333333,
      trim: 0xffd700,
      bannerHex: "#111111",
      borderHex: "#FFD700",
      text: "SHOP",
      perk: "BONUS",
    };

    const archHeight = 2.0;
    const laneSpan = 1.48;
    const pillarMat = this.cachedMat(`shop-pillar-${entity.subType}`, () =>
      new THREE.MeshStandardMaterial({
        color: brand.bg,
        emissive: brand.trim,
        emissiveIntensity: 0.55,
        roughness: 0.3,
      }),
    );

    // Glowing boost pad on the lane floor
    const pad = new THREE.Mesh(
      this.cachedGeo("shop-pad", () => new THREE.PlaneGeometry(2.2, 1.32)),
      this.cachedMat(`shop-pad-${entity.subType}`, () =>
        new THREE.MeshBasicMaterial({
          color: brand.trim,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
        }),
      ),
    );
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.025;
    group.add(pad);

    // Side gantry pillars
    const pillarGeo = this.cachedGeo("shop-pillar", () =>
      new THREE.BoxGeometry(0.18, archHeight, 0.18),
    );
    for (const pz of [-laneSpan / 2, laneSpan / 2]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(0, archHeight / 2, pz);
      group.add(pillar);
    }

    // Overhead neon signboard with readable CanvasTexture facing camera
    const signTex = this.getShopSignTexture(entity.subType);
    const signMat = this.cachedMat(`shop-billboard-${entity.subType}`, () =>
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    const signBackMat = this.cachedMat(`shop-back-${entity.subType}`, () =>
      new THREE.MeshLambertMaterial({ color: brand.bg }),
    );

    const signBox = new THREE.Mesh(
      this.cachedGeo("shop-banner", () => new THREE.BoxGeometry(0.24, 0.72, 2.2)),
      [signMat, signMat, signBackMat, signBackMat, signMat, signMat],
    );
    signBox.position.set(0, archHeight + 0.3, 0);
    // Slight angle toward our isometric camera so text is super legible!
    signBox.rotation.y = Math.PI / 4;
    group.add(signBox);
  }

  // ── MOPED UPDATE ────────────────────────────────────────────────────────

  private updateMoped(state: RenderState): void {
    if (!this.mopedParts) return;

    const targetZ = laneToZ(state.player.targetLane);
    const currentZ = laneToZ(state.player.lane);
    const t = state.player.laneProgress;
    const eased = 1 - (1 - t) * (1 - t);
    const mopedZ = currentZ + (targetZ - currentZ) * eased;
    this.currentMopedZ = mopedZ;

    // Wheelie physics arc
    let wheelieY = 0;
    let wheeliePitch = 0;
    if (state.player.isWheeling) {
      const duration =
        state.player.wheelieDuration > 0 ? state.player.wheelieDuration : 500;
      const progress = Math.max(
        0,
        Math.min(1, state.player.wheelieTimer / duration),
      );
      const arc = Math.sin(progress * Math.PI);
      wheeliePitch = arc * 0.42;
      wheelieY = arc * 0.52;
    }
    this.currentMopedY = wheelieY;

    this.mopedGroup.position.set(0, wheelieY, mopedZ);
    this.mopedGroup.rotation.z = wheeliePitch;
    // Dynamic bank/lean into lane changes!
    this.mopedGroup.rotation.x = state.player.leanAngle * 0.28;

    // Rider subtly leans back during wheelies
    this.mopedParts.rider.rotation.z = wheeliePitch * 0.3;

    // Headlight beam intensifies at dusk/night zones
    const beamMat = this.mopedParts.headlightBeam.material as THREE.MeshBasicMaterial;
    beamMat.opacity = state.zoneIndex >= 2 ? 0.28 : 0.12;

    // Magnet halo pulse
    this.mopedParts.magnetHalo.visible = state.magnetActive;
    if (state.magnetActive) {
      const pulse = 1 + Math.sin(this.frameCount * 0.2) * 0.14;
      this.mopedParts.magnetHalo.scale.set(pulse, pulse, 1);
    }

    // Spin spoked wheels
    if (state.phase === "running" && !state.paused) {
      const wheelSpeed = state.speed * 0.014;
      this.mopedParts.rearWheel.rotation.z -= wheelSpeed * 0.08;
      this.mopedParts.frontWheel.rotation.z -= wheelSpeed * 0.08;
    }

    // Invincibility blink
    if (state.player.isInvincible) {
      this.mopedGroup.visible = Math.sin(state.player.invincibleTimer * 0.03) > -0.2;
    } else {
      this.mopedGroup.visible = true;
    }
  }

  // ── PARTICLES UPDATE ────────────────────────────────────────────────────

  private updateParticles(state: RenderState, dt: number): void {
    const maxE = this.q.maxExhaust;
    const exhaustX = -0.95;
    const exhaustY = 0.5 + this.currentMopedY;

    const speedNorm = Math.min(state.speed / 450, 1);
    const spawnRate = state.speedBoostActive ? 5.5 : speedNorm * 3.2;
    if (
      state.phase === "running" &&
      Math.random() < spawnRate * dt * 60 &&
      this.particles.length < maxE
    ) {
      this.particles.push({
        x: exhaustX + (Math.random() - 0.5) * 0.1,
        y: exhaustY + (Math.random() - 0.5) * 0.08,
        z: this.currentMopedZ + 0.15 + (Math.random() - 0.5) * 0.1,
        vx: -1.4 - Math.random() * 2 - state.speed * 0.006,
        vy: 0.45 + Math.random() * 0.85,
        vz: (Math.random() - 0.5) * 0.25,
        life: 0,
        maxLife: 0.38 + Math.random() * 0.28,
        size: 0.055 + Math.random() * 0.075,
        color: state.speedBoostActive ? 0xffd700 : 0xb4b8c5,
      });
    }

    this.particles = this.particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.maxLife) return false;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.size += dt * 0.16;
      return true;
    });

    const activeCount = this.particles.length;
    for (let i = 0; i < activeCount; i++) {
      const p = this.particles[i]!;
      const s = p.size * (1 + p.life * 2.6);
      _tmpMatrix.makeScale(s, s, s);
      _tmpVec.set(p.x, p.y, p.z);
      _tmpMatrix.setPosition(_tmpVec);
      this.exhaustInstanced.setMatrixAt(i, _tmpMatrix);
      this.exhaustInstanced.setColorAt(i, _tmpColor.setHex(p.color));
    }
    this.exhaustInstanced.count = activeCount;
    if (activeCount > 0) {
      this.exhaustInstanced.instanceMatrix.needsUpdate = true;
      if (this.exhaustInstanced.instanceColor) {
        this.exhaustInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateSparkles(dt: number): void {
    this.sparkles = this.sparkles.filter((s) => {
      s.life += dt;
      if (s.life >= s.maxLife) return false;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy -= 8.5 * dt;
      return true;
    });

    const activeCount = this.sparkles.length;
    for (let i = 0; i < activeCount; i++) {
      const s = this.sparkles[i]!;
      const alpha = 1 - s.life / s.maxLife;
      const sc = 0.1 * alpha;
      _tmpMatrix.makeScale(sc, sc, sc);
      _tmpVec.set(s.x, s.y, s.z);
      _tmpMatrix.setPosition(_tmpVec);
      this.sparkleInstanced.setMatrixAt(i, _tmpMatrix);
      this.sparkleInstanced.setColorAt(i, _tmpColor.setHex(s.color));
    }
    this.sparkleInstanced.count = activeCount;
    if (activeCount > 0) {
      this.sparkleInstanced.instanceMatrix.needsUpdate = true;
      if (this.sparkleInstanced.instanceColor) {
        this.sparkleInstanced.instanceColor.needsUpdate = true;
      }
    }
  }

  private updateSpeedLines(state: RenderState, dt: number): void {
    const maxSL = this.q.maxSpeedLines;

    if (state.speed < 240 && !state.speedBoostActive) {
      if (this.speedLines.length > 0) this.speedLines = [];
      this.speedLineInstanced.count = 0;
      return;
    }

    const intensity = state.speedBoostActive
      ? 1.0
      : Math.min((state.speed - 240) / 180, 1);

    if (Math.random() < intensity * dt * 45 && this.speedLines.length < maxSL) {
      this.speedLines.push({
        x: 16 + Math.random() * 5,
        z: ROAD_Z_MIN + Math.random() * (ROAD_Z_MAX - ROAD_Z_MIN),
        length: 0.7 + Math.random() * 2.2 * intensity,
        speed: 18 + state.speed * 0.045 + Math.random() * 6,
      });
    }

    this.speedLines = this.speedLines.filter((sl) => {
      sl.x -= sl.speed * dt;
      return sl.x + sl.length > -16;
    });

    const activeCount = this.speedLines.length;
    for (let i = 0; i < activeCount; i++) {
      const sl = this.speedLines[i]!;
      _tmpMatrix.makeScale(sl.length, 1, 1);
      _tmpVec.set(sl.x, 0.35 + (i % 3) * 0.3, sl.z);
      _tmpMatrix.setPosition(_tmpVec);
      this.speedLineInstanced.setMatrixAt(i, _tmpMatrix);
    }
    this.speedLineInstanced.count = activeCount;
    if (activeCount > 0) {
      this.speedLineInstanced.instanceMatrix.needsUpdate = true;
    }
  }

  private updateHitFlash(state: RenderState): void {
    const mat = this.hitFlashPlane.material as THREE.MeshBasicMaterial;
    if (state.hitFlashTimer > 0) {
      mat.opacity = Math.min(0.45, (state.hitFlashTimer / 280) * 0.45);
    } else {
      mat.opacity = 0;
    }
  }

  private updateShake(state: RenderState, dt: number): void {
    if (state.hitFlashTimer > 0) {
      this.shakeIntensity = Math.max(this.shakeIntensity, 8);
    }
    if (this.shakeIntensity > 0.1) {
      this.shakeOffset.x = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeOffset.y = (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-12 * dt);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
    }
  }

  private updateBloom(state: RenderState): void {
    if (!this.bloomPass) return;
    this.bloomPass.strength = state.speedBoostActive
      ? 0.85
      : state.zoneIndex >= 2
        ? 0.65
        : 0.48;
  }
}
