"use client";

import type { ComicCaption } from "@/lib/simulator/contract";

interface CaptionLayerProps {
  captions: ComicCaption[];
}

const TONE_STYLES: Record<ComicCaption["tone"], string> = {
  gold: "bg-[#FFD700] text-black border-black",
  cyan: "bg-cyan-300 text-black border-black",
  orange: "bg-orange-400 text-black border-black",
  red: "bg-red-600 text-white border-black",
  white: "bg-white text-black border-black",
};

const ROTATIONS = ["-1.2deg", "1.2deg", "-0.6deg"] as const;

export function CaptionLayer({ captions }: CaptionLayerProps) {
  if (captions.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-3 z-[25] flex flex-col items-center gap-1.5 px-4 select-none"
    >
      {captions.slice(-3).map((caption) => {
        const rotate = ROTATIONS[Math.abs(caption.id) % ROTATIONS.length]!;
        const ratio =
          caption.maxTtlMs > 0
            ? Math.max(0, Math.min(1, caption.ttlMs / caption.maxTtlMs))
            : 1;
        const opacity = ratio < 0.25 ? ratio / 0.25 : 1;
        const floatUpPx = Math.round((1 - ratio) * 8);
        const popScale = ratio > 0.85 ? 1.06 : 1;

        return (
          <div
            key={caption.id}
            style={{
              opacity,
              transform: `translateY(${-floatUpPx}px) rotate(${rotate}) scale(${popScale})`,
              fontFamily: 'var(--font-bangers), Impact, "Arial Black", sans-serif',
            }}
            className={`w-fit max-w-[88%] border-[3px] px-3 py-0.5 text-center text-lg leading-tight tracking-wider break-words uppercase shadow-[4px_4px_0px_#000] transition-transform duration-75 sm:text-2xl ${TONE_STYLES[caption.tone]}`}
          >
            {caption.text}
          </div>
        );
      })}
    </div>
  );
}
