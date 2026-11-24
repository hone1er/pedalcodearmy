"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

// Three.js is large; only load it when a product actually has a 3D model slide.
const Model3dViewer = dynamic(
  () => import("@/components/model-3d-viewer").then((mod) => mod.Model3dViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#111216]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFD700]" aria-hidden="true" />
        <span className="sr-only">Loading 3D viewer…</span>
      </div>
    ),
  },
);

export type CarouselMedia =
  | { type: "image"; src: string; alt?: string }
  | { type: "video"; src: string; poster?: string }
  | { type: "embed"; src: string; provider?: "instagram" }
  | {
      type: "model3d";
      src: string;
      poster?: string;
      usdzSrc?: string;
      alt?: string;
    };

interface ProductImageCarouselProps {
  media: CarouselMedia[];
  alt: string;
  /** Set on the first product card only, so just one above-the-fold image is preloaded. */
  isPriorityCard?: boolean;
}

const CARD_IMAGE_SIZES = "(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw";
const SWIPE_THRESHOLD_PX = 40;

function mediaKindLabel(item: CarouselMedia): string {
  switch (item.type) {
    case "image":
      return "photo";
    case "video":
      return "video";
    case "model3d":
      return "3D model";
    default:
      return "reel";
  }
}

export function ProductImageCarousel({
  media,
  alt,
  isPriorityCard = false,
}: ProductImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const count = media.length;
  const activeIndex = count > 0 ? Math.min(index, count - 1) : 0;

  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === activeIndex) {
        void video.play().catch(() => {
          // Autoplay rejected — user can press play
        });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [activeIndex]);

  if (count === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (count < 2 || event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // Leave arrow keys to native video controls (seek/volume).
    if (event.target instanceof HTMLVideoElement) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    // Don't hijack scrubbing/volume gestures on native video controls.
    if (event.target instanceof HTMLVideoElement) {
      touchStartRef.current = null;
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current =
      touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || count < 2) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  const activeItem = media[activeIndex];

  return (
    <div
      className="relative aspect-square w-full overflow-hidden bg-black outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#FFD700]"
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} media`}
      tabIndex={count > 1 ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
      }}
    >
      {media.map((item, i) => {
        const isActive = i === activeIndex;
        // `invisible` (visibility: hidden) keeps off-slide content — notably the
        // shadow-DOM controls of <video controls> — out of the Tab order.
        // Transitioning visibility alongside opacity preserves the fade-out.
        const baseClass = `absolute inset-0 transition-[opacity,visibility] duration-300 ${
          isActive ? "visible z-10 opacity-100" : "pointer-events-none invisible z-0 opacity-0"
        }`;
        const slideProps = {
          className: baseClass,
          role: "group" as const,
          "aria-roledescription": "slide",
          "aria-label": `${i + 1} of ${count}`,
          "aria-hidden": !isActive,
        };

        if (item.type === "image") {
          return (
            <div key={`${item.src}-${i}`} {...slideProps}>
              <Image
                src={item.src}
                alt={item.alt ?? `${alt} (${i + 1} of ${count})`}
                fill
                sizes={CARD_IMAGE_SIZES}
                className="object-cover"
                priority={isPriorityCard && i === 0}
              />
            </div>
          );
        }

        if (item.type === "video") {
          return (
            <div key={`${item.src}-${i}`} {...slideProps}>
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={item.src}
                poster={item.poster}
                preload="none"
                // Always muted: autoplaying any slide must never start audio
                // (and unmuted autoplay is blocked by browsers anyway).
                muted
                playsInline
                loop
                autoPlay={i === 0}
                controls
                tabIndex={isActive ? 0 : -1}
                className="h-full w-full object-cover"
                aria-label={`${alt} video (${i + 1} of ${count})`}
              />
            </div>
          );
        }

        if (item.type === "model3d") {
          return (
            <div key={`${item.src}-${i}`} {...slideProps}>
              <Model3dViewer
                src={item.src}
                poster={item.poster}
                usdzSrc={item.usdzSrc}
                alt={item.alt ?? `${alt} 3D model`}
                active={isActive}
              />
            </div>
          );
        }

        // embed
        return (
          <div
            key={`${item.src}-${i}`}
            {...slideProps}
            className={`${baseClass} flex items-center justify-center bg-black`}
          >
            {isActive && (
              <iframe
                src={item.src}
                title={`${alt} reel (${i + 1} of ${count})`}
                allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
                sandbox="allow-scripts allow-same-origin"
                allowFullScreen
                scrolling="no"
                className="h-full w-full border-0"
                loading="lazy"
              />
            )}
          </div>
        );
      })}

      {count > 1 && (
        <>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {activeItem
              ? `Showing ${mediaKindLabel(activeItem)} ${activeIndex + 1} of ${count}`
              : ""}
          </div>

          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous media"
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-[#FFD700]"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next media"
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-none border-2 border-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-[#FFD700]"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-none border-2 border-black bg-white px-1">
            {media.map((item, i) => {
              const isActive = i === activeIndex;
              const label = `Show ${mediaKindLabel(item)} ${i + 1} of ${count}`;
              return (
                <button
                  key={`${item.src}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={label}
                  aria-current={isActive ? "true" : undefined}
                  className="flex h-6 min-w-6 items-center justify-center px-0.5"
                >
                  {item.type === "model3d" ? (
                    <span
                      aria-hidden="true"
                      className={`border border-black px-1 py-0.5 text-[10px] font-black uppercase leading-none ${
                        isActive ? "bg-black text-[#FFD700]" : "bg-[#FFD700] text-black"
                      }`}
                    >
                      3D
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={`block h-2.5 w-2.5 border border-black ${
                        isActive ? "bg-black" : "bg-white"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
