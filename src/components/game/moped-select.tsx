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

/** Reference-accurate side-profile vector silhouettes modeled on Pedal Code Army's real mopeds */
function MopedSilhouette({ make }: { make: MopedMake }) {
  const isMag = make === "derbi-variant" || make === "tomos-a35";
  const wheelR = make === "tomos-a35" ? 15 : 16.5;

  const renderWheel = (cx: number, cy: number) => (
    <g>
      <circle cx={cx} cy={cy} r={wheelR} fill="#09090B" stroke="#D4D4D8" strokeWidth="2.6" />
      {isMag ? (
        <>
          {(make === "tomos-a35" ? [0, 60, 120, 180, 240, 300] : [0, 72, 144, 216, 288]).map(
            (deg) => {
              const rad = (deg * Math.PI) / 180;
              return (
                <line
                  key={deg}
                  x1={cx}
                  y1={cy}
                  x2={cx + Math.cos(rad) * (wheelR - 2)}
                  y2={cy + Math.sin(rad) * (wheelR - 2)}
                  stroke="#CBD5E1"
                  strokeWidth="2.2"
                />
              );
            },
          )}
        </>
      ) : (
        <>
          {[0, 45, 90, 135].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <line
                key={deg}
                x1={cx - Math.cos(rad) * (wheelR - 2)}
                y1={cy - Math.sin(rad) * (wheelR - 2)}
                x2={cx + Math.cos(rad) * (wheelR - 2)}
                y2={cy + Math.sin(rad) * (wheelR - 2)}
                stroke="#9CA3AF"
                strokeWidth="0.9"
              />
            );
          })}
        </>
      )}
      <circle cx={cx} cy={cy} r="4.2" fill="#E5E7EB" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 150 86"
      className="h-20 w-36 transition-transform duration-200 group-hover:scale-105"
      aria-hidden="true"
    >
      {renderWheel(34, 62)}
      {renderWheel(116, 62)}

      {/* 1. PUCH MAXI S — Yellow monocoque, chrome U-rail, flat bench seat, black front fender, riser bars */}
      {make === "puch-maxi" && (
        <>
          {/* Exhaust & E50 engine */}
          <path d="M78 66 L22 64" stroke="#D1D5DB" strokeWidth="4" strokeLinecap="round" />
          <rect x="64" y="57" width="18" height="10" rx="2" fill="#71717A" />
          {/* Pressed-steel yellow monocoque + wrap-around rear fender */}
          <path
            d="M100 24 L106 29 L76 56 L58 56 L50 34 L34 34 L18 44 L14 58 L20 58 L28 45 L44 45 L53 60 L76 60 L100 34 Z"
            fill="#FACC15"
            stroke="#A16207"
            strokeWidth="1"
          />
          {/* Black PUCH tank stripe */}
          <line x1="95" y1="33" x2="77" y2="50" stroke="#18181B" strokeWidth="3.2" />
          {/* Signature chrome step-through rail */}
          <path d="M62 50 L54 50 L48 42 L38 42" stroke="#E5E7EB" strokeWidth="1.6" fill="none" />
          {/* Black coil rear shock */}
          <line x1="42" y1="38" x2="34" y2="62" stroke="#18181B" strokeWidth="3.5" strokeLinecap="round" />
          {/* Flat Puch bench seat & chrome rear rack */}
          <rect x="33" y="25" width="32" height="9" rx="2.5" fill="#18181B" />
          <path d="M18 35 L33 35 L30 39 L17 39 Z" stroke="#E5E7EB" strokeWidth="1.8" fill="none" />
          {/* Yellow upper forks + chrome lowers + matte black front fender */}
          <line x1="102" y1="24" x2="111" y2="48" stroke="#FACC15" strokeWidth="4" strokeLinecap="round" />
          <line x1="111" y1="48" x2="116" y2="62" stroke="#E5E7EB" strokeWidth="3" strokeLinecap="round" />
          <path d="M98 54 A 19 19 0 0 1 128 45" stroke="#18181B" strokeWidth="4.2" fill="none" strokeLinecap="round" />
          {/* Tall riser chrome handlebars + round headlight + VDO speedo */}
          <path d="M102 24 L94 10 L86 12" stroke="#E5E7EB" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <circle cx="111" cy="28" r="5" fill="#18181B" stroke="#E5E7EB" strokeWidth="1.2" />
          <circle cx="114" cy="28" r="3" fill="#FEF08A" />
          <rect x="104" y="19" width="6" height="5" rx="1" fill="#18181B" />
          <rect x="11" y="42" width="6" height="5" fill="#EF4444" />
        </>
      )}

      {/* 2. HONDA HOBBIT PA50 — Slim red U-frame, cream-white downtube covers, shrouded white shocks, upturned race pipe */}
      {make === "honda-hobbit" && (
        <>
          {/* Upturned black race expansion pipe & CVT case */}
          <path d="M84 67 Q54 73 20 51" stroke="#18181B" strokeWidth="5.2" fill="none" strokeLinecap="round" />
          <rect x="38" y="57" width="38" height="8" rx="3" fill="#3F3F46" />
          {/* Slim red U-frame */}
          <path
            d="M100 25 L106 30 L74 58 L56 58 L46 34 L38 34 L51 62 L76 62 L101 34 Z"
            fill="#DC2626"
          />
          {/* Iconic cream-white tapered Honda downtube side cover */}
          <polygon points="99,31 103,35 76,57 62,57 64,51 75,51" fill="#F5F5DC" stroke="#D6D3C4" strokeWidth="0.8" />
          {/* Red rear fender + horizontal red rack + chrome side rails */}
          <path d="M18 52 A 18 18 0 0 1 48 44" stroke="#DC2626" strokeWidth="4" fill="none" strokeLinecap="round" />
          <rect x="18" y="34" width="28" height="4" fill="#DC2626" />
          <path d="M44 37 L18 37 L20 55 L34 55" stroke="#E5E7EB" strokeWidth="1.5" fill="none" />
          {/* Iconic chunky cream-white shrouded rear shocks */}
          <line x1="42" y1="36" x2="34" y2="62" stroke="#F5F5DC" strokeWidth="4.8" strokeLinecap="round" />
          {/* Short bulbous Hobbit solo saddle */}
          <rect x="39" y="24" width="23" height="10" rx="4" fill="#18181B" />
          {/* Red forks + horn shield + red front fender */}
          <line x1="102" y1="24" x2="116" y2="62" stroke="#DC2626" strokeWidth="3.8" strokeLinecap="round" />
          <rect x="103" y="29" width="7" height="14" rx="1" fill="#DC2626" transform="rotate(-18 106 36)" />
          <path d="M100 52 A 18 18 0 0 1 126 45" stroke="#DC2626" strokeWidth="3.8" fill="none" strokeLinecap="round" />
          {/* Riser bars + boxy PA50 headlight cowl */}
          <path d="M102 24 L95 11 L87 13" stroke="#E5E7EB" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <rect x="103" y="18" width="11" height="9" rx="1.5" fill="#DC2626" />
          <rect x="112" y="19" width="3" height="7" fill="#FEF08A" />
          <rect x="13" y="42" width="6" height="6" fill="#EF4444" />
        </>
      )}

      {/* 3. DERBI VARIANT SL — Pearl-white sharp angular monocoque, long flat bench seat, black upper forks & Estoril pipe */}
      {make === "derbi-variant" && (
        <>
          {/* Black Estoril expansion pipe & exposed gold variator bell */}
          <path d="M84 67 Q56 71 18 55" stroke="#18181B" strokeWidth="5.5" fill="none" strokeLinecap="round" />
          <rect x="68" y="57" width="17" height="9" rx="2" fill="#52525B" />
          <circle cx="56" cy="61" r="5" fill="#EAB308" stroke="#18181B" strokeWidth="1.5" />
          {/* Sharp angular pearl-white Spanish monocoque */}
          <path
            d="M100 22 L106 25 L82 56 L54 56 L47 33 L24 33 L14 43 L11 54 L17 54 L25 43 L42 43 L48 60 L82 60 L101 32 Z"
            fill="#F4F4F5"
            stroke="#A1A1AA"
            strokeWidth="1"
          />
          {/* Black DERBI floorboard decal & gold SL emblem */}
          <rect x="57" y="56" width="21" height="3" fill="#18181B" />
          <rect x="37" y="40" width="7" height="7" rx="1" fill="#EAB308" />
          {/* Chrome coil rear shock */}
          <line x1="38" y1="35" x2="34" y2="62" stroke="#E5E7EB" strokeWidth="3.2" strokeLinecap="round" />
          {/* Flush sleek two-up bench seat */}
          <rect x="23" y="25" width="38" height="8" rx="2" fill="#18181B" />
          {/* Tall black upper forks + silver lowers + white front fender */}
          <line x1="102" y1="22" x2="111" y2="48" stroke="#18181B" strokeWidth="4.4" strokeLinecap="round" />
          <line x1="111" y1="48" x2="116" y2="62" stroke="#D4D4D8" strokeWidth="3" strokeLinecap="round" />
          <path d="M99 52 A 19 19 0 0 1 129 46" stroke="#F4F4F5" strokeWidth="3.8" fill="none" strokeLinecap="round" />
          {/* Low street bars + compact chrome headlight */}
          <line x1="102" y1="22" x2="90" y2="19" stroke="#18181B" strokeWidth="3" strokeLinecap="round" />
          <circle cx="111" cy="25" r="5" fill="#D4D4D8" />
          <circle cx="114" cy="25" r="3.2" fill="#FEF08A" />
          <rect x="11" y="38" width="6" height="8" fill="#EF4444" />
        </>
      )}

      {/* 4. TOMOS A35 — Metallic silver diagonal box-tank, sculpted aero nose fairing, black fork boots, 6-spoke mags */}
      {make === "tomos-a35" && (
        <>
          {/* Black low exhaust & angled A35 cylinder */}
          <path d="M80 65 L20 63" stroke="#18181B" strokeWidth="4.4" strokeLinecap="round" />
          <rect x="68" y="54" width="16" height="10" rx="2" fill="#27272A" transform="rotate(-18 76 59)" />
          {/* Straight diagonal silver Tomos box-tank frame + sleek horizontal rear side fairing */}
          <path
            d="M99 27 L105 32 L76 55 L58 55 L50 35 L43 35 L52 59 L77 59 L100 36 Z"
            fill="#D4D4D8"
            stroke="#71717A"
            strokeWidth="1"
          />
          <polygon points="62,51 24,52 22,57 62,57" fill="#D4D4D8" stroke="#71717A" strokeWidth="0.9" />
          {/* Silver rear & front fenders */}
          <path d="M18 52 A 17 17 0 0 1 48 45" stroke="#D4D4D8" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M101 52 A 17 17 0 0 1 128 47" stroke="#D4D4D8" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          {/* Chrome rear shock */}
          <line x1="45" y1="37" x2="34" y2="62" stroke="#E5E7EB" strokeWidth="3" strokeLinecap="round" />
          {/* Compact curved black saddle + rear rack */}
          <rect x="33" y="27" width="26" height="9" rx="3.5" fill="#18181B" />
          <line x1="17" y1="37" x2="33" y2="37" stroke="#27272A" strokeWidth="2.8" strokeLinecap="round" />
          {/* Chrome forks WITH black rubber accordion fork gaiters */}
          <line x1="102" y1="26" x2="116" y2="62" stroke="#D4D4D8" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="106" y1="36" x2="111" y2="49" stroke="#18181B" strokeWidth="5.2" strokeLinecap="round" />
          {/* Signature aerodynamic silver Tomos nose fairing & amber signal pod! */}
          <path
            d="M101 34 L114 33 L115 22 L106 11 L101 13 Z"
            fill="#D4D4D8"
            stroke="#71717A"
            strokeWidth="1"
          />
          <rect x="113" y="22" width="3.5" height="7" fill="#FEF08A" />
          <circle cx="109" cy="29" r="2.2" fill="#F59E0B" />
          <line x1="101" y1="22" x2="90" y2="20" stroke="#18181B" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="13" y="42" width="6" height="5" fill="#EF4444" />
        </>
      )}
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
          const bars = getStatBars(make);
          return (
            <button
              key={make}
              type="button"
              onClick={() => onSelect(make)}
              className="group flex flex-col items-center gap-3 border-4 border-gray-700 bg-zinc-950 p-5 text-left transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:border-[#FFD700] hover:shadow-[6px_6px_0px_0px_rgba(255,215,0,0.85)] focus-visible:border-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <MopedSilhouette make={make} />

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
