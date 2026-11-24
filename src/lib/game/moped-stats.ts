import type { MopedMake, MopedInfo, MopedStats } from "./types";

// Display info for each moped
export const MOPED_INFO: Record<MopedMake, MopedInfo> = {
  "puch-maxi": {
    id: "puch-maxi",
    name: "Puch Maxi",
    tagline: "Austrian Step-Through Legend",
    description: "Balanced and forgiving with steady handling and generous combo timing.",
    perkName: "Steady Groove",
    perkDescription: "4.5s combo timer for easier high-multiplier chains",
    colorScheme: { frame: "#FFFFFF", accent: "#22C55E" },
  },
  "honda-hobbit": {
    id: "honda-hobbit",
    name: "Honda Hobbit",
    tagline: "PA50 Street Ripper",
    description: "Razor-sharp lane snaps and crisp response for weaving through tight traffic.",
    perkName: "Zippy Snap",
    perkDescription: "Ultra-fast lane shifts & snappy direction reversals",
    colorScheme: { frame: "#EF4444", accent: "#FFFFFF" },
  },
  "derbi-variant": {
    id: "derbi-variant",
    name: "Derbi Variant",
    tagline: "Spanish Stunt Machine",
    description: "Blistering pace and high-arc wheelies built for fearless riders.",
    perkName: "Stunt King",
    perkDescription: "+50% bonus points on Wheelie Clears & loftier hops",
    colorScheme: { frame: "#3B82F6", accent: "#EAB308" },
  },
  "tomos-a35": {
    id: "tomos-a35",
    name: "Tomos A35",
    tagline: "Yugoslav Two-Speed Tank",
    description: "Built to survive Oakland potholes with extra armor and longer recovery.",
    perkName: "Iron Frame",
    perkDescription: "4 HP armor + extended 2.0s post-hit shield",
    colorScheme: { frame: "#374151", accent: "#C0C0C0" },
  },
};

// Runner stats per moped
export const MOPED_STATS: Record<MopedMake, MopedStats> = {
  "puch-maxi": {
    baseSpeed: 210,
    speedMultiplier: 1.0,
    laneChangeSpeed: 155,
    maxHealth: 3,
    wheelieHeight: 42,
    wheelieDuration: 520,
    invincibilityMs: 1500,
    comboWindowMs: 4500,
    wheelieBonusMultiplier: 1.0,
    frameStyle: "step-through",
  },
  "honda-hobbit": {
    baseSpeed: 222,
    speedMultiplier: 1.06,
    laneChangeSpeed: 115,
    maxHealth: 3,
    wheelieHeight: 38,
    wheelieDuration: 480,
    invincibilityMs: 1500,
    comboWindowMs: 3800,
    wheelieBonusMultiplier: 1.0,
    frameStyle: "top-bar",
  },
  "derbi-variant": {
    baseSpeed: 242,
    speedMultiplier: 1.15,
    laneChangeSpeed: 165,
    maxHealth: 3,
    wheelieHeight: 50,
    wheelieDuration: 580,
    invincibilityMs: 1400,
    comboWindowMs: 3800,
    wheelieBonusMultiplier: 1.5,
    frameStyle: "sport",
  },
  "tomos-a35": {
    baseSpeed: 205,
    speedMultiplier: 0.96,
    laneChangeSpeed: 150,
    maxHealth: 4,
    wheelieHeight: 40,
    wheelieDuration: 520,
    invincibilityMs: 2000,
    comboWindowMs: 4000,
    wheelieBonusMultiplier: 1.0,
    frameStyle: "classic",
  },
};

export function getMopedStats(make: MopedMake): MopedStats {
  return MOPED_STATS[make];
}
