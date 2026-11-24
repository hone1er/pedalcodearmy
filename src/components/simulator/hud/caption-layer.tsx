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

const SLOT_POSITIONS = [
  { left: "50%", top: "12%", rotate: "-2deg" },
  { left: "46%", top: "20%", rotate: "2deg" },
  { left: "54%", top: "28%", rotate: "-1.5deg" },
  { left: "50%", top: "16%", rotate: "1.5deg" },
] as const;

export function CaptionLayer({ captions }: CaptionLayerProps) {
  if (captions.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-[25] overflow-hidden select-none"
    >
      {captions.slice(-4).map((caption) => {
        const slot = SLOT_POSITIONS[Math.abs(caption.id) % SLOT_POSITIONS.length]!;
        const ratio =
          caption.maxTtlMs > 0
            ? Math.max(0, Math.min(1, caption.ttlMs / caption.maxTtlMs))
            : 1;
        const opacity = ratio < 0.25 ? ratio / 0.25 : 1;
        const floatUpPx = Math.round((1 - ratio) * 18);
        const popScale = ratio > 0.85 ? 1.08 : 1;

        return (
          <div
            key={caption.id}
            style={{
              left: slot.left,
              top: slot.top,
              opacity,
              transform: `translate(-50%, ${-floatUpPx}px) rotate(${slot.rotate}) scale(${popScale})`,
              fontFamily: 'var(--font-bangers), Impact, "Arial Black", sans-serif',
            }}
            className={`absolute w-max max-w-[88%] border-[3px] px-3 py-0.5 text-center text-xl tracking-wider break-words uppercase shadow-[4px_4px_0px_#000] transition-transform duration-75 sm:text-2xl ${TONE_STYLES[caption.tone]}`}
          >
            {caption.text}
          </div>
        );
      })}
    </div>
  );
}
