import type { MopedMake, MopedInfo, MopedStats } from "./types";

// Display info for each moped
export const MOPED_INFO: Record<MopedMake, MopedInfo> = {
  "puch-maxi": {
    id: "puch-maxi",
    name: "Puch Maxi",
    description: "Balanced and forgiving. Great for beginners.",
    colorScheme: { frame: "#FFFFFF", accent: "#22C55E" },
  },
  "honda-hobbit": {
    id: "honda-hobbit",
    name: "Honda Hobbit",
    description: "Quick lane changes. Honda reliability in the streets.",
    colorScheme: { frame: "#EF4444", accent: "#FFFFFF" },
  },
  "derbi-variant": {
    id: "derbi-variant",
    name: "Derbi Variant",
    description: "High speed, but less forgiving. For experienced riders.",
    colorScheme: { frame: "#3B82F6", accent: "#EAB308" },
  },
  "tomos-a35": {
    id: "tomos-a35",
    name: "Tomos A35",
    description: "Extra durable -- 4 health. Yugoslav tank.",
    colorScheme: { frame: "#1F2937", accent: "#C0C0C0" },
  },
};

// Runner stats per moped
export const MOPED_STATS: Record<MopedMake, MopedStats> = {
  "puch-maxi": {
    baseSpeed: 200,
    speedMultiplier: 1.0,
    laneChangeSpeed: 180,
    maxHealth: 3,
    wheelieHeight: 40,
    wheelieDuration: 500,
  },
  "honda-hobbit": {
    baseSpeed: 210,
    speedMultiplier: 1.05,
    laneChangeSpeed: 140,
    maxHealth: 3,
    wheelieHeight: 35,
    wheelieDuration: 450,
  },
  "derbi-variant": {
    baseSpeed: 230,
    speedMultiplier: 1.15,
    laneChangeSpeed: 200,
    maxHealth: 3,
    wheelieHeight: 45,
    wheelieDuration: 550,
  },
  "tomos-a35": {
    baseSpeed: 195,
    speedMultiplier: 0.95,
    laneChangeSpeed: 170,
    maxHealth: 4,
    wheelieHeight: 38,
    wheelieDuration: 500,
  },
};

export function getMopedStats(make: MopedMake): MopedStats {
  return MOPED_STATS[make];
}
