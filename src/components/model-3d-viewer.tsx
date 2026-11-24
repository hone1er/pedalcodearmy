"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Loader2 } from "lucide-react";

export interface Model3dViewerProps {
  src: string;
  poster?: string;
  usdzSrc?: string;
  alt?: string;
  active: boolean;
}

function disposeMaterial(material: THREE.Material) {
  const record = material as unknown as Record<string, unknown>;
  for (const value of Object.values(record)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
}

function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry instanceof THREE.BufferGeometry) {
        obj.geometry.dispose();
      }
      if (Array.isArray(obj.material)) {
        for (const mat of obj.material) {
          if (mat instanceof THREE.Material) {
            disposeMaterial(mat);
          }
        }
      } else if (obj.material instanceof THREE.Material) {
        disposeMaterial(obj.material);
      }
    }
  });
}

export function Model3dViewer({
  src,
  poster,
  usdzSrc,
  alt = "Interactive 3D product model",
  active,
}: Model3dViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let animationFrameId: number | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111216");

    setStatus("loading");

    try {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.setClearColor(0x111216, 1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const canvas = renderer.domElement;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      container.innerHTML = "";
      container.appendChild(canvas);

      const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 500);
      camera.position.set(0, 0.5, 2.5);

      // Studio-style workshop lighting
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x2a2d38, 1.35);
      hemiLight.position.set(0, 10, 0);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
      keyLight.position.set(6, 9, 7);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xeef4ff, 1.1);
      fillLight.position.set(-6, 4, -5);
      scene.add(fillLight);

      controls = new OrbitControls(camera, canvas);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.8;

      const stopAutoRotate = () => {
        if (controls) {
          controls.autoRotate = false;
        }
      };
      controls.addEventListener("start", stopAutoRotate);

      const updateSize = () => {
        if (!renderer || !container) return;
        const w = Math.max(container.clientWidth, 1);
        const h = Math.max(container.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };

      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);

      const loader = new GLTFLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        src,
        (gltf) => {
          if (disposed) {
            disposeObject3D(gltf.scene);
            return;
          }

          const model = gltf.scene;
          scene.add(model);

          // Center model at origin and fit camera cleanly to bounding sphere
          const initialBox = new THREE.Box3().setFromObject(model);
          const center = initialBox.getCenter(new THREE.Vector3());
          model.position.sub(center);

          const centeredBox = new THREE.Box3().setFromObject(model);
          const sphere = new THREE.Sphere();
          centeredBox.getBoundingSphere(sphere);
          const radius = Math.max(sphere.radius, 0.001);

          const vFov = THREE.MathUtils.degToRad(camera.fov);
          const aspect = Math.max(camera.aspect, 0.5);
          const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
          const limitingFov = Math.min(vFov, hFov);
          const distance = (radius / Math.sin(limitingFov / 2)) * 1.15;

          camera.position.set(distance * 0.65, distance * 0.45, distance * 0.8);
          camera.near = Math.max(radius * 0.01, 0.001);
          camera.far = Math.max(radius * 100, distance * 20);
          camera.updateProjectionMatrix();

          if (controls) {
            controls.target.set(0, 0, 0);
            controls.minDistance = radius * 0.5;
            controls.maxDistance = radius * 6;
            controls.update();
          }

          setStatus("ready");
        },
        undefined,
        (error) => {
          if (disposed) return;
          console.error("Failed to load 3D model:", error);
          setStatus("error");
        },
      );

      const animate = () => {
        if (disposed) return;
        animationFrameId = window.requestAnimationFrame(animate);
        controls?.update();
        renderer?.render(scene, camera);
      };
      animate();

      return () => {
        disposed = true;
        if (animationFrameId !== null) {
          window.cancelAnimationFrame(animationFrameId);
        }
        resizeObserver?.disconnect();
        if (controls) {
          controls.removeEventListener("start", stopAutoRotate);
          controls.dispose();
        }
        disposeObject3D(scene);
        if (renderer) {
          renderer.dispose();
          if (renderer.domElement.parentNode === container) {
            container.removeChild(renderer.domElement);
          }
        }
      };
    } catch (error) {
      console.error("Failed to initialize 3D viewer:", error);
      setStatus("error");
      return () => {
        disposed = true;
        resizeObserver?.disconnect();
        controls?.dispose();
        disposeObject3D(scene);
        renderer?.dispose();
      };
    }
  }, [active, src]);

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden bg-[#111216]"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
      role="region"
      aria-label={alt}
    >
      {/* WebGL mount container */}
      <div
        ref={containerRef}
        className={`h-full w-full cursor-grab active:cursor-grabbing ${
          status === "error" ? "hidden" : "block"
        }`}
      />

      {/* Poster behind loading state or as error/inactive fallback */}
      {poster && status !== "ready" && (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={poster}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className={`object-cover ${
              status === "loading" ? "opacity-35" : "opacity-100"
            }`}
          />
        </div>
      )}

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#111216]/60">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" />
          <span className="border-2 border-black bg-black px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#FFD700]">
            Loading 3D Model...
          </span>
        </div>
      )}

      {/* Error fallback banner */}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 p-4 text-center">
          <Box className="mb-2 h-8 w-8 text-[#FFD700]" />
          <span className="border-2 border-black bg-[#FFD700] px-2 py-1 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            3D Preview Unavailable
          </span>
        </div>
      )}

      {/* Top-left brutalist badge */}
      {status !== "error" && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-none border-2 border-black bg-[#FFD700] px-2 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Box className="h-3.5 w-3.5" />
          <span>3D MODEL &bull; DRAG TO ROTATE</span>
        </div>
      )}

      {/* Optional iOS Quick Look AR link */}
      {usdzSrc && (
        <a
          rel="ar"
          href={usdzSrc}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1 rounded-none border-2 border-black bg-[#FFD700] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors hover:bg-yellow-400"
          aria-label={`View ${alt} in AR`}
        >
          <Box className="h-3 w-3" />
          AR
        </a>
      )}
    </div>
  );
}
