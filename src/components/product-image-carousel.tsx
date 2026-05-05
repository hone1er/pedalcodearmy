"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CarouselMedia =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string }
  | { type: "embed"; src: string; provider?: "instagram" };

interface ProductImageCarouselProps {
  media: CarouselMedia[];
  alt: string;
}

export function ProductImageCarousel({ media, alt }: ProductImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const count = media.length;

  useEffect(() => {
    videoRefs.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) {
        void video.play().catch(() => {
          // Autoplay rejected — user can press play
        });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }, [index]);

  if (count === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-black">
      {media.map((item, i) => {
        const isActive = i === index;
        const baseClass = `absolute inset-0 transition-opacity duration-300 ${
          isActive ? "opacity-100" : "pointer-events-none opacity-0"
        }`;

        if (item.type === "image") {
          return (
            <div key={`${item.src}-${i}`} className={baseClass}>
              <Image
                src={item.src}
                alt={`${alt} (${i + 1} of ${count})`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          );
        }

        if (item.type === "video") {
          return (
            <div key={`${item.src}-${i}`} className={baseClass}>
              <video
                ref={(el) => {
                  videoRefs.current[i] = el;
                }}
                src={item.src}
                poster={item.poster}
                muted={i === 0}
                playsInline
                loop
                autoPlay={i === 0}
                controls
                className="h-full w-full object-cover"
                aria-label={`${alt} video (${i + 1} of ${count})`}
              />
            </div>
          );
        }

        // embed
        return (
          <div
            key={`${item.src}-${i}`}
            className={`${baseClass} flex items-center justify-center bg-black`}
          >
            {isActive && (
              <iframe
                src={item.src}
                title={`${alt} reel (${i + 1} of ${count})`}
                allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
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
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-none border-2 border-black bg-white/90 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-[#FFD700]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-none border-2 border-black bg-white/90 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all hover:bg-[#FFD700]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 rounded-none border-2 border-black bg-white/90 px-2 py-1">
            {media.map((item, i) => (
              <button
                key={`${item.src}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show item ${i + 1}`}
                className={`h-2 w-2 border border-black transition-colors ${
                  i === index ? "bg-orange-500" : "bg-white"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
