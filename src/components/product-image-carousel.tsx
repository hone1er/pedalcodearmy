"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductImageCarouselProps {
  images: string[];
  alt: string;
}

export function ProductImageCarousel({ images, alt }: ProductImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const count = images.length;

  if (count === 0) return null;

  const goPrev = () => setIndex((i) => (i - 1 + count) % count);
  const goNext = () => setIndex((i) => (i + 1) % count);

  return (
    <div className="relative aspect-square w-full overflow-hidden">
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt={`${alt} (${i + 1} of ${count})`}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className={`object-cover transition-opacity duration-300 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
          priority={i === 0}
        />
      ))}

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
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Show photo ${i + 1}`}
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
