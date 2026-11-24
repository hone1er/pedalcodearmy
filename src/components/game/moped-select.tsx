"use client";

import type { MopedMake } from "@/lib/game/types";
import { MOPED_INFO, MOPED_STATS } from "@/lib/game/moped-stats";

interface MopedSelectProps {
  onSelect: (make: MopedMake) => void;
}

const MOPED_MAKES: MopedMake[] = [
  "puch-maxi",
  "honda-hobbit",
  "derbi-variant",
  "tomos-a35",
];

function getStatBars(make: MopedMake) {
  const stats = MOPED_STATS[make];
  const speed = Math.round(((stats.baseSpeed - 195) / 50) * 4 + 1);
  const handling = Math.round(((175 - stats.laneChangeSpeed) / 65) * 4 + 1);
  const armor = stats.maxHealth === 4 ? 5 : 3;
  const wheelie = Math.round(((stats.wheelieHeight - 34) / 18) * 4 + 1);

  return {
    speed: Math.min(5, Math.max(1, speed)),
    handling: Math.min(5, Math.max(1, handling)),
    armor: Math.min(5, Math.max(1, armor)),
    wheelie: Math.min(5, Math.max(1, wheelie)),
  };
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="w-16 font-bold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      <div className="flex gap-1" aria-label={`${label}: ${value} out of 5`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-4 border border-black ${
              i < value ? "bg-[#FFD700]" : "bg-gray-800"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/** Stylized vector side-profile silhouette tinted with each moped's real colors */
function MopedSilhouette({
  frame,
  accent,
  style,
}: {
  frame: string;
  accent: string;
  style: "step-through" | "top-bar" | "sport" | "classic";
}) {
  return (
    <svg
      viewBox="0 0 140 76"
      className="h-16 w-32 transition-transform duration-200 group-hover:scale-105"
      aria-hidden="true"
    >
      {/* Exhaust */}
      <path
        d="M54 55 L20 49 L14 44"
        stroke="#9CA3AF"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Rear & Front Wheels */}
      <circle cx="32" cy="54" r="16" fill="#111827" stroke="#E5E7EB" strokeWidth="3" />
      <circle cx="32" cy="54" r="5" fill="#9CA3AF" />
      <circle cx="108" cy="54" r="16" fill="#111827" stroke="#E5E7EB" strokeWidth="3" />
      <circle cx="108" cy="54" r="5" fill="#9CA3AF" />

      {/* Front forks */}
      <line x1="108" y1="54" x2="94" y2="18" stroke="#D1D5DB" strokeWidth="4.5" strokeLinecap="round" />
      {/* Handlebars */}
      <path d="M94 18 L84 14" stroke="#E5E7EB" strokeWidth="4" strokeLinecap="round" />

      {/* Frame Silhouette */}
      {style === "step-through" && (
        <path
          d="M32 54 L64 52 L96 27"
          stroke={frame}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      )}
      {style === "top-bar" && (
        <>
          <path d="M32 54 L64 52 L95 30" stroke={frame} strokeWidth="6" fill="none" />
          <rect x="52" y="25" width="42" height="12" rx="4" fill={frame} />
          <rect x="58" y="29" width="28" height="4" fill={accent} />
        </>
      )}
      {style === "sport" && (
        <>
          <path d="M32 54 L64 52 L95 28" stroke={frame} strokeWidth="7" fill="none" />
          <path d="M52 33 L94 26 L90 38 L56 41 Z" fill={frame} />
          <path d="M96 18 L112 24 L106 38 L94 34 Z" fill={accent} />
        </>
      )}
      {style === "classic" && (
        <>
          <path d="M32 54 L64 50 L96 27" stroke={frame} strokeWidth="8" fill="none" />
          <line x1="16" y1="34" x2="40" y2="34" stroke="#D1D5DB" strokeWidth="3.5" strokeLinecap="round" />
        </>
      )}

      {/* Seat */}
      <rect x="34" y="27" width="28" height="8" rx="3" fill="#1F2937" stroke={accent} strokeWidth="1.5" />
      {/* Headlight */}
      <circle cx="105" cy="27" r="5" fill="#FEF08A" />
      {/* Accent fender stripe */}
      <path d="M18 41 Q32 34 45 42" stroke={accent} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M96 42 Q108 35 120 42" stroke={accent} strokeWidth="3.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function MopedSelect({ onSelect }: MopedSelectProps) {
  return (
    <div className="flex flex-col items-center gap-6 px-4">
      <div className="text-center">
        <p className="text-xs font-black uppercase tracking-widest text-gray-400">
          Pick Your Two-Stroke Weapon
        </p>
        <h2
          className="mt-1 text-3xl text-[#FFD700] md:text-4xl"
          style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
        >
          CHOOSE YOUR RIDE
        </h2>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {MOPED_MAKES.map((make) => {
          const info = MOPED_INFO[make];
          const stats = MOPED_STATS[make];
          const bars = getStatBars(make);
          return (
            <button
              key={make}
              type="button"
              onClick={() => onSelect(make)}
              className="group flex flex-col items-center gap-3 border-4 border-gray-700 bg-zinc-950 p-5 text-left transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-[#FFD700] hover:shadow-[6px_6px_0px_0px_rgba(255,215,0,0.85)] focus-visible:border-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <MopedSilhouette
                frame={info.colorScheme.frame}
                accent={info.colorScheme.accent}
                style={stats.frameStyle}
              />

              <div className="text-center">
                <h3
                  className="text-xl uppercase tracking-wide text-white group-hover:text-[#FFD700]"
                  style={{
                    fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                  }}
                >
                  {info.name}
                </h3>
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {info.tagline}
                </p>
                <p className="mt-1.5 text-xs text-gray-300">
                  {info.description}
                </p>
              </div>

              {/* Perk Badge */}
              <div className="w-full border-2 border-[#FFD700]/40 bg-[#FFD700]/10 px-3 py-1.5 text-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#FFD700]">
                  PERK: {info.perkName}
                </span>
                <p className="text-[11px] text-gray-300">
                  {info.perkDescription}
                </p>
              </div>

              {/* Stat bars */}
              <div className="mt-1 w-full max-w-[13rem] space-y-1.5">
                <StatBar label="Speed" value={bars.speed} />
                <StatBar label="Handling" value={bars.handling} />
                <StatBar label="Armor" value={bars.armor} />
                <StatBar label="Wheelie" value={bars.wheelie} />
              </div>

              <span
                className="mt-1 w-full border-2 border-gray-700 bg-black py-1.5 text-center text-xs font-black uppercase tracking-wider text-gray-300 transition-colors group-hover:border-[#FFD700] group-hover:bg-[#FFD700] group-hover:text-black"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Kickstart &rarr;
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
