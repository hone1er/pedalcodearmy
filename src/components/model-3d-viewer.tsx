"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Box, Hand, Loader2, RotateCcw, X } from "lucide-react";

export interface Model3dViewerProps {
  src: string;
  poster?: string;
  usdzSrc?: string;
  alt?: string;
  /** Whether this slide is the visible one in its carousel. */
  active: boolean;
}

const KEY_ROTATE_STEP = THREE.MathUtils.degToRad(10);

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
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
      if (obj.geometry instanceof THREE.BufferGeometry) {
        obj.geometry.dispose();
      }
      const materials: unknown[] = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of materials) {
        if (mat instanceof THREE.Material) {
          disposeMaterial(mat);
        }
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
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const activateButtonRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef(false);
  const controlsRef = useRef<OrbitControls | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [interactive, setInteractive] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    setIsCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Leaving the slide always exits interaction mode.
  useEffect(() => {
    if (!active) setInteractive(false);
  }, [active]);

  // WebGL lifecycle. Deliberately NOT dependent on `interactive`, so toggling
  // interaction never tears down and recreates the GL context.
  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let animationFrameId: number | null = null;
    let isVisible = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#111216");

    const stopLoop = () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };

    const cleanup = () => {
      disposed = true;
      stopLoop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      if (controls) {
        controls.dispose();
      }
      controlsRef.current = null;
      disposeObject3D(scene);
      scene.clear();
      if (renderer) {
        renderer.renderLists.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      }
    };

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
      canvas.setAttribute("aria-hidden", "true");
      container.replaceChildren(canvas);

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
      // Start passive: no drag/zoom until the shopper opts in. OrbitControls
      // sets touch-action: none on connect; restore vertical page scrolling.
      controls.enabled = false;
      controls.enableZoom = false;
      canvas.style.touchAction = "pan-y";
      controlsRef.current = controls;

      const onControlStart = () => {
        if (controls) controls.autoRotate = false;
      };
      controls.addEventListener("start", onControlStart);

      const renderFrame = () => {
        if (disposed) return;
        controls?.update();
        renderer?.render(scene, camera);
      };

      const loop = () => {
        if (disposed || !isVisible) {
          animationFrameId = null;
          return;
        }
        renderFrame();
        animationFrameId = window.requestAnimationFrame(loop);
      };

      const startLoop = () => {
        if (animationFrameId === null && !disposed && isVisible) {
          animationFrameId = window.requestAnimationFrame(loop);
        }
      };

      const updateSize = () => {
        if (!renderer || !container) return;
        const w = Math.max(container.clientWidth, 1);
        const h = Math.max(container.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
        if (animationFrameId === null) renderFrame();
      };

      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);

      // Pause rendering entirely while scrolled off-screen.
      if (typeof IntersectionObserver !== "undefined") {
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[entries.length - 1];
            isVisible = entry?.isIntersecting ?? true;
            if (isVisible) {
              startLoop();
            } else {
              stopLoop();
              // Scrolled away: release keyboard/zoom capture.
              setInteractive(false);
            }
          },
          { threshold: 0.01 },
        );
        intersectionObserver.observe(container);
      }

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
            // Snapshot the fitted view so "Reset view" can return to it.
            controls.saveState();
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

      startLoop();

      return () => {
        controls?.removeEventListener("start", onControlStart);
        cleanup();
      };
    } catch (error) {
      console.error("Failed to initialize 3D viewer:", error);
      setStatus("error");
      return cleanup;
    }
  }, [active, src]);

  // Toggle interaction on the live controls without rebuilding the scene.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const canvas = controls.domElement as HTMLElement | null;
    controls.enabled = interactive;
    controls.enableZoom = interactive;
    if (canvas) {
      // Interactive: the shopper asked to drag/pinch the model.
      // Passive: never block vertical page scrolling.
      canvas.style.touchAction = interactive ? "none" : "pan-y";
    }
    if (interactive) {
      // Shift/Ctrl + arrow keys orbit via OrbitControls' own handler. Interaction
      // ends on Escape, "Done", blur, or scrolling away, so this window listener
      // never lingers and blocks arrow-key page scrolling.
      controls.listenToKeyEvents(window);
      wrapperRef.current?.focus({ preventScroll: true });
    } else {
      controls.stopListenToKeyEvents();
      if (returnFocusRef.current) {
        returnFocusRef.current = false;
        activateButtonRef.current?.focus({ preventScroll: true });
      }
    }
    return () => {
      controls.stopListenToKeyEvents();
    };
  }, [interactive, status]);

  const exitInteractive = useCallback((returnFocus: boolean) => {
    returnFocusRef.current = returnFocus;
    setInteractive(false);
  }, []);

  const resetView = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.reset();
    controls.autoRotate = true;
  }, []);

  // Plain arrow keys orbit the model while interacting (OrbitControls only
  // rotates with a modifier when panning is disabled). Stop propagation so the
  // surrounding carousel doesn't also change slides.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!interactive) return;
    const controls = controlsRef.current;
    if (event.key === "Escape") {
      event.stopPropagation();
      exitInteractive(true);
      return;
    }
    // Modified arrows are left to OrbitControls' window listener (and are
    // ignored by the carousel), so don't stop them here.
    if (!controls || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
      return;
    }
    let handled = true;
    switch (event.key) {
      case "ArrowLeft":
        controls.rotateLeft(KEY_ROTATE_STEP);
        break;
      case "ArrowRight":
        controls.rotateLeft(-KEY_ROTATE_STEP);
        break;
      case "ArrowUp":
        controls.rotateUp(KEY_ROTATE_STEP);
        break;
      case "ArrowDown":
        controls.rotateUp(-KEY_ROTATE_STEP);
        break;
      default:
        handled = false;
    }
    if (handled) {
      controls.autoRotate = false;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const stopIfInteractive = (event: React.SyntheticEvent) => {
    if (interactive) event.stopPropagation();
  };

  const enterInteractive = () => {
    // Move focus into the viewer before the activate button unmounts, so the
    // removal doesn't blur the viewer and immediately cancel interaction.
    wrapperRef.current?.focus({ preventScroll: true });
    setInteractive(true);
  };

  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    // Ignore the blur from a toolbar button being removed after Done/Escape.
    if (!interactive || returnFocusRef.current) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    exitInteractive(false);
  };

  const controlTabIndex = active ? 0 : -1;
  const activateLabel = isCoarsePointer ? "Tap to interact" : "Click to interact";

  return (
    <div
      ref={wrapperRef}
      onBlur={handleBlur}
      className="relative h-full w-full select-none overflow-hidden bg-[#111216] outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#FFD700]"
      style={{ touchAction: interactive ? "none" : "pan-y" }}
      onPointerDown={stopIfInteractive}
      onTouchStart={stopIfInteractive}
      onTouchEnd={stopIfInteractive}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : -1}
      role="group"
      aria-roledescription="3D viewer"
      aria-label={
        interactive
          ? `${alt}. Drag or use arrow keys to rotate, scroll or pinch to zoom. Press Escape to finish.`
          : alt
      }
    >
      {/* WebGL mount container */}
      <div
        ref={containerRef}
        className={`h-full w-full ${interactive ? "cursor-grab active:cursor-grabbing" : ""} ${
          status === "error" ? "hidden" : "block"
        }`}
      />

      {/* Poster behind loading state or as error/inactive fallback */}
      {poster && status !== "ready" && (
        <div className="pointer-events-none absolute inset-0">
          <Image
            src={poster}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={`object-cover ${
              status === "loading" ? "opacity-35" : "opacity-100"
            }`}
          />
        </div>
      )}

      {/* Loading overlay */}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#111216]/60">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" aria-hidden="true" />
          <span className="border-2 border-[#FFD700] bg-black px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[#FFD700]">
            Loading 3D Model...
          </span>
        </div>
      )}

      {/* Error fallback banner */}
      {status === "error" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 p-4 text-center">
          <Box className="mb-2 h-8 w-8 text-[#FFD700]" aria-hidden="true" />
          <span className="border-2 border-black bg-[#FFD700] px-2 py-1 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            3D Preview Unavailable
          </span>
        </div>
      )}

      {/* Top-left badge */}
      {status !== "error" && (
        <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1.5 rounded-none border-2 border-[#FFD700] bg-black px-2 py-1 text-xs font-black uppercase tracking-wider text-[#FFD700] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <Box className="h-3.5 w-3.5" aria-hidden="true" />
          <span>3D Model</span>
        </div>
      )}

      {/* Opt-in activation: covers the canvas so page scroll/swipe work until tapped */}
      {status === "ready" && !interactive && (
        <button
          ref={activateButtonRef}
          type="button"
          onClick={enterInteractive}
          tabIndex={controlTabIndex}
          aria-hidden={!active}
          className="group absolute inset-0 z-10 flex items-end justify-center pb-12 focus-visible:outline-none"
          aria-label={`${activateLabel} with ${alt}`}
        >
          <span className="flex items-center gap-1.5 rounded-none border-2 border-black bg-[#FFD700] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-4 group-focus-visible:ring-white">
            <Hand className="h-4 w-4" aria-hidden="true" />
            {activateLabel}
          </span>
        </button>
      )}

      {/* Interaction toolbar */}
      {status === "ready" && interactive && (
        <div className="absolute bottom-12 left-1/2 z-20 flex w-max -translate-x-1/2 gap-2 whitespace-nowrap">
          {/* preventDefault on mousedown keeps focus on the viewer: Safari doesn't
              focus buttons on click, so the blur would carry relatedTarget === null
              and unmount this toolbar before the click fires. */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={resetView}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-none border-2 border-black bg-white px-2.5 py-1.5 text-xs font-black uppercase text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-[#FFD700]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset View
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exitInteractive(true)}
            className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-none border-2 border-black bg-black px-2.5 py-1.5 text-xs font-black uppercase text-[#FFD700] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-900"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Done
          </button>
        </div>
      )}

      {/* Optional iOS Quick Look AR link */}
      {usdzSrc && (
        <a
          rel="ar"
          href={usdzSrc}
          tabIndex={controlTabIndex}
          aria-hidden={!active}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-none border-2 border-[#FFD700] bg-black px-2.5 py-1 text-xs font-black uppercase tracking-wider text-[#FFD700] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors hover:bg-gray-900"
          aria-label={`View ${alt} in AR`}
        >
          <Box className="h-3.5 w-3.5" aria-hidden="true" />
          AR
        </a>
      )}
    </div>
  );
}
