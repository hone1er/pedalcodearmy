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

// Normalize stats to 1-5 scale for display
function getStatBars(make: MopedMake) {
  const stats = MOPED_STATS[make];
  // Speed: 195-230 range -> 1-5
  const speed = Math.round(((stats.baseSpeed - 190) / 40) * 4 + 1);
  // Handling: 140-200 range (lower is better) -> 1-5
  const handling = Math.round(((200 - stats.laneChangeSpeed) / 60) * 4 + 1);
  // Health: 3-4 -> mapped
  const health = stats.maxHealth === 4 ? 5 : 3;

  return {
    speed: Math.min(5, Math.max(1, speed)),
    handling: Math.min(5, Math.max(1, handling)),
    health: Math.min(5, Math.max(1, health)),
  };
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-400">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`h-2.5 w-3 rounded-sm ${
              i < value ? "bg-[#FFD700]" : "bg-gray-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function MopedSelect({ onSelect }: MopedSelectProps) {
  return (
    <div className="flex flex-col items-center gap-6 px-4">
      <h2
        className="text-2xl text-[#FFD700] md:text-3xl"
        style={{ fontFamily: "Russo One, sans-serif" }}
      >
        CHOOSE YOUR RIDE
      </h2>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {MOPED_MAKES.map((make) => {
          const info = MOPED_INFO[make];
          const bars = getStatBars(make);
          return (
            <button
              key={make}
              onClick={() => onSelect(make)}
              className="group flex flex-col items-center gap-3 rounded-lg border-4 border-gray-700 bg-black/80 p-5 text-left transition-all hover:border-[#FFD700] hover:shadow-[0_0_20px_rgba(255,215,0,0.3)]"
            >
              {/* Color swatch */}
              <div className="flex items-center gap-2">
                <div
                  className="h-6 w-12 rounded border-2 border-gray-600"
                  style={{ backgroundColor: info.colorScheme.frame }}
                />
                <div
                  className="h-6 w-4 rounded border-2 border-gray-600"
                  style={{ backgroundColor: info.colorScheme.accent }}
                />
              </div>

              <div className="text-center">
                <h3
                  className="text-xl text-white group-hover:text-[#FFD700]"
                  style={{ fontFamily: "Russo One, sans-serif" }}
                >
                  {info.name}
                </h3>
                <p className="mt-1 text-sm text-gray-400">
                  {info.description}
                </p>
              </div>

              {/* Stat bars */}
              <div className="mt-1 space-y-1">
                <StatBar label="Speed" value={bars.speed} />
                <StatBar label="Handling" value={bars.handling} />
                <StatBar label="Health" value={bars.health} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
