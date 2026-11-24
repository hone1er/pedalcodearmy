// East Bay ride missions for Ran When Parked.

import type { RouteId, RouteSegment, RouteSpec } from "../contract";

export const ROUTES: RouteSpec[] = [
  {
    id: "telegraph-coffee",
    name: "Telegraph Coffee Run",
    subtitle: "Oakland → Berkeley • morning",
    lengthM: 1600,
    rewardCash: 55,
    rewardRep: 15,
    repRequired: 0,
    difficulty: "chill",
    hasCoffeeCup: true,
    timeOfDay: "morning",
    description:
      "Grab a cortado on Telegraph and get it to the crew at the shop while it's still hot. Two stoplights — a perfect idle test. Watch the potholes.",
    segments: [
      { startM: 0, endM: 220, gradePct: 0, potholeDensity: 0.15, landmark: "Fox Theater" },
      { startM: 220, endM: 520, gradePct: 1.5, potholeDensity: 0.35, hasStoplight: true, landmark: "Telegraph & 27th" },
      { startM: 520, endM: 860, gradePct: 2, potholeDensity: 0.25, landmark: "Temescal murals" },
      { startM: 860, endM: 1180, gradePct: 0.5, potholeDensity: 0.4, hasStoplight: true, landmark: "Telegraph & Alcatraz" },
      { startM: 1180, endM: 1600, gradePct: 1, potholeDensity: 0.2, landmark: "Coffee shop on Telegraph" },
    ],
  },
  {
    id: "lake-merritt-cruise",
    name: "Lake Merritt Cruise",
    subtitle: "Lakeshore loop • golden hour",
    lengthM: 2000,
    rewardCash: 70,
    rewardRep: 25,
    repRequired: 10,
    difficulty: "chill",
    timeOfDay: "golden",
    description:
      "Rolling lakeside loop past the pergola and the geese. Easy hills, long open stretches — find out how your bike pulls at cruising speed.",
    segments: [
      { startM: 0, endM: 300, gradePct: 0, potholeDensity: 0.1, landmark: "Grand Lake Theatre" },
      { startM: 300, endM: 650, gradePct: 3, potholeDensity: 0.15, landmark: "Pergola" },
      { startM: 650, endM: 950, gradePct: -2.5, potholeDensity: 0.1, hasStoplight: true, landmark: "Lakeshore Ave" },
      { startM: 950, endM: 1400, gradePct: 1.5, potholeDensity: 0.2, landmark: "Necklace of Lights" },
      { startM: 1400, endM: 1700, gradePct: -1.5, potholeDensity: 0.1, landmark: "Boat house" },
      { startM: 1700, endM: 2000, gradePct: 0.5, potholeDensity: 0.15, landmark: "Children's Fairyland" },
    ],
  },
  {
    id: "grizzly-peak-climb",
    name: "Grizzly Peak Climb",
    subtitle: "Berkeley Hills • sunset",
    lengthM: 1800,
    rewardCash: 110,
    rewardRep: 40,
    repRequired: 25,
    difficulty: "spicy",
    timeOfDay: "sunset",
    description:
      "A sustained 6–12% climb up to the overlook. Keep the head temp in check — pedal-assist (LPA) on the steep parts, and if it pings, back off before it seizes.",
    segments: [
      { startM: 0, endM: 250, gradePct: 3, potholeDensity: 0.2, landmark: "Claremont Ave" },
      { startM: 250, endM: 600, gradePct: 6, potholeDensity: 0.25, landmark: "Fish Ranch Rd" },
      { startM: 600, endM: 950, gradePct: 9, potholeDensity: 0.3, landmark: "Switchbacks" },
      { startM: 950, endM: 1250, gradePct: 12, potholeDensity: 0.35, landmark: "The Wall" },
      { startM: 1250, endM: 1550, gradePct: 8, potholeDensity: 0.25, landmark: "Steam Trains" },
      { startM: 1550, endM: 1800, gradePct: 6, potholeDensity: 0.15, landmark: "Grizzly Peak Overlook" },
    ],
  },
  {
    id: "midnight-tunnel",
    name: "Midnight Tunnel Blast",
    subtitle: "Caldecott Tunnel • night",
    lengthM: 2400,
    rewardCash: 150,
    rewardRep: 60,
    repRequired: 50,
    difficulty: "send-it",
    timeOfDay: "night",
    description:
      "Late-night top-speed run through the Caldecott with the crew. Long, flat and fast — tuck in, get on the pipe, and keep it out of the red.",
    segments: [
      { startM: 0, endM: 400, gradePct: 1, potholeDensity: 0.1, landmark: "Broadway on-ramp" },
      { startM: 400, endM: 800, gradePct: 2.5, potholeDensity: 0.1, landmark: "Tunnel approach" },
      { startM: 800, endM: 1800, gradePct: 0, potholeDensity: 0.05, landmark: "Caldecott Tunnel" },
      { startM: 1800, endM: 2400, gradePct: -2, potholeDensity: 0.15, landmark: "Orinda exit" },
    ],
  },
];

export function getRouteById(id: RouteId): RouteSpec | undefined {
  return ROUTES.find((r) => r.id === id);
}

export function segmentAt(route: RouteSpec, distanceM: number): RouteSegment | undefined {
  const d = Math.max(0, Math.min(route.lengthM - 0.001, distanceM));
  return route.segments.find((s) => d >= s.startM && d < s.endM) ?? route.segments[route.segments.length - 1];
}
