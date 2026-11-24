// Parts, instruments & Craigslist finds for Ran When Parked.
// Prices & part names borrow from the real-world build recipes in
// src/data/build-recipes.ts — every part links to a real moped shop.

import type {
  CraigslistListing,
  InstrumentSpec,
  OwnedBike,
  PartSlot,
  PartSpec,
  SimBikeMake,
} from "../contract";

const TREATLAND = { url: "https://www.treatland.tv", label: "Treatland" };
const MOPEDS_1977 = { url: "https://www.1977mopeds.com", label: "1977 Mopeds" };
const MYRONS = { url: "https://www.myronsmopeds.com", label: "Myron's Mopeds" };

const BUY_LABEL = (vendor: string) => `Buy the real one → ${vendor}`;

const JET_SIZES = [56, 60, 64, 68, 72, 78, 84] as const;

function jetPart(size: number): PartSpec {
  return {
    id: `jet-${size}`,
    name: `Bing/Dellorto Main Jet #${size}`,
    slot: "main-jet",
    vendor: "bay-mopeds",
    price: 6,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      size <= 60
        ? `Size ${size} main jet. Right around stock for a 12mm Bing on a stock pipe — go smaller only if the plug reads dark.`
        : size <= 68
          ? `Size ${size} main jet. Bolt-on territory: a pipe or a 15mm SHA wants this extra fuel.`
          : `Size ${size} main jet. Big-kit jetting — on a stock bike this will four-stroke and smoke like a chimney.`,
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    jetSize: size,
    visualTag: "stock",
  };
}

export const PARTS_CATALOG: PartSpec[] = [
  // ── SPARK PLUGS ────────────────────────────────────────────────────────
  {
    id: "plug-ngk-b6hs",
    name: "NGK B6HS Spark Plug",
    slot: "spark-plug",
    vendor: "bay-mopeds",
    price: 5,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "The trusty stock heat range. Gap it to 0.6mm. A fresh plug is the cheapest fix in mopeding — always carry a spare.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    sparkBonus: 0,
    visualTag: "stock",
  },
  {
    id: "plug-ngk-b7hs",
    name: "NGK B7HS Spark Plug (Colder)",
    slot: "spark-plug",
    vendor: "east-bay-speed",
    price: 6,
    repRequired: 10,
    compatibleMakes: "all",
    description:
      "One step colder. Kitted bikes love it — it sheds heat from a hot-running 70cc top end. On a stock bike it fouls faster.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    sparkBonus: 0.05,
    coolingBonus: 0.04,
    visualTag: "performance",
  },

  // ── MAIN JETS ──────────────────────────────────────────────────────────
  ...JET_SIZES.map(jetPart),

  // ── CARBURETORS ────────────────────────────────────────────────────────
  {
    id: "carb-bing-12",
    name: "Bing 12mm (Stock)",
    slot: "carburetor",
    vendor: "bay-mopeds",
    price: 40,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "The stock 12mm Bing. Reliable, simple, and happy around a 60 main jet with a stock pipe.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    airflowMult: 1,
    fuelFlowRate: 1,
    visualTag: "stock",
  },
  {
    id: "carb-dellorto-15",
    name: "Dellorto SHA 15.15",
    slot: "carburetor",
    vendor: "golden-gate-parts",
    price: 55,
    repRequired: 10,
    compatibleMakes: "all",
    description:
      "The classic upgrade from stock. More airflow, more top end — and it needs a bigger main jet (think ~4 sizes) or it'll run lean and hot.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    airflowMult: 1.14,
    torqueMult: 1.1,
    maxRpmBonus: 600,
    fuelFlowRate: 1.18,
    visualTag: "performance",
  },

  // ── EXHAUSTS ───────────────────────────────────────────────────────────
  {
    id: "pipe-stock-maxi",
    name: "Stock Exhaust",
    slot: "exhaust",
    vendor: "bay-mopeds",
    price: 60,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "Quiet, restrictive, and torquey down low. Tops out around 30 mph on flat ground.",
    realVendorUrl: MYRONS.url,
    realVendorLabel: BUY_LABEL(MYRONS.label),
    torqueMult: 1,
    powerbandRpm: 5200,
    maxRpmBonus: 0,
    visualTag: "stock",
  },
  {
    id: "pipe-tecno-boss",
    name: "Tecno Boss Expansion Pipe",
    slot: "exhaust",
    vendor: "golden-gate-parts",
    price: 120,
    repRequired: 10,
    compatibleMakes: "all",
    description:
      "A solid all-around expansion chamber. Wakes up the midrange and adds a real kick around 7,000 rpm. Jet up ~4 sizes.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    torqueMult: 1.06,
    powerbandRpm: 7400,
    maxRpmBonus: 1100,
    visualTag: "performance",
  },
  {
    id: "pipe-proma-circuit",
    name: "Proma Circuit Race Pipe",
    slot: "exhaust",
    vendor: "east-bay-speed",
    price: 165,
    repRequired: 40,
    compatibleMakes: "all",
    description:
      "Peaky race pipe. Soggy below 7k, then it hits the powerband like a slingshot. Loves a big kit and a 15mm+ carb. Jet up ~6 sizes.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    torqueMult: 0.97,
    powerbandRpm: 9000,
    maxRpmBonus: 2000,
    visualTag: "race",
  },

  // ── CYLINDERS ──────────────────────────────────────────────────────────
  {
    id: "cyl-stock-50",
    name: "Stock 50cc Cylinder & Piston",
    slot: "cylinder",
    vendor: "bay-mopeds",
    price: 90,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "Fresh stock bore and piston. Restores compression on a tired, scored top end.",
    realVendorUrl: MOPEDS_1977.url,
    realVendorLabel: BUY_LABEL(MOPEDS_1977.label),
    torqueMult: 1,
    compressionBonus: 0,
    visualTag: "stock",
  },
  {
    id: "cyl-airsal-65",
    name: "Airsal 65cc Cylinder Kit",
    slot: "cylinder",
    vendor: "golden-gate-parts",
    price: 180,
    repRequired: 20,
    compatibleMakes: "all",
    description:
      "Cast-iron 65cc kit. Torquey, forgiving, and a big step up for hills. Bump your jet ~6 sizes and watch your plug.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    torqueMult: 1.28,
    maxRpmBonus: 500,
    compressionBonus: 0.06,
    coolingBonus: 0.03,
    visualTag: "performance",
  },
  {
    id: "cyl-treat-70",
    name: "Treats 70cc Race Kit",
    slot: "cylinder",
    vendor: "east-bay-speed",
    price: 240,
    repRequired: 50,
    compatibleMakes: "all",
    description:
      "Aluminum 70cc race kit. Huge power, revs high, runs hot. Lean it out and it will seize — jet rich and break it in gently.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    torqueMult: 1.42,
    maxRpmBonus: 900,
    compressionBonus: 0.1,
    coolingBonus: 0.1,
    visualTag: "race",
  },

  // ── AIR FILTERS ────────────────────────────────────────────────────────
  {
    id: "filter-stock-box",
    name: "Stock Air Box",
    slot: "air-filter",
    vendor: "bay-mopeds",
    price: 12,
    repRequired: 0,
    compatibleMakes: "all",
    description: "Stock silenced air box with a foam element. Quiet and slightly restrictive.",
    realVendorUrl: MYRONS.url,
    realVendorLabel: BUY_LABEL(MYRONS.label),
    airflowMult: 1,
    visualTag: "stock",
  },
  {
    id: "filter-mesh-pod",
    name: "Mesh Pod Filter",
    slot: "air-filter",
    vendor: "golden-gate-parts",
    price: 25,
    repRequired: 5,
    compatibleMakes: "all",
    description:
      "High-flow mesh pod. Louder intake honk, a little more top end, and it leans you out ~2 jet sizes.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    airflowMult: 1.05,
    torqueMult: 1.03,
    maxRpmBonus: 200,
    visualTag: "performance",
  },

  // ── FUEL FILTERS ───────────────────────────────────────────────────────
  {
    id: "fuel-filter-inline",
    name: "Inline Fuel Filter (Fresh)",
    slot: "fuel-filter",
    vendor: "bay-mopeds",
    price: 4,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "Clear inline filter. Old tank rust and varnish clog these — if the float bowl drains on a hill, start here.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    fuelFlowRate: 1,
    visualTag: "stock",
  },

  // ── IGNITIONS ──────────────────────────────────────────────────────────
  {
    id: "ign-points-stock",
    name: "Points & Condenser (Stock)",
    slot: "ignition",
    vendor: "bay-mopeds",
    price: 20,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "Fresh points and condenser. Gap to 0.35–0.40mm. Brings a tired, orange spark back to a fat blue one.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    sparkBonus: 0,
    visualTag: "stock",
  },
  {
    id: "ign-hpi-cdi",
    name: "HPI Race CDI",
    slot: "ignition",
    vendor: "east-bay-speed",
    price: 140,
    repRequired: 30,
    compatibleMakes: "all",
    description:
      "Electronic race CDI. No points to wear out, a hot consistent spark, and it won't float at high rpm.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    sparkBonus: 0.2,
    maxRpmBonus: 800,
    visualTag: "race",
  },

  // ── INTAKE GASKETS ─────────────────────────────────────────────────────
  {
    id: "gasket-intake-stock",
    name: "Intake Gasket (Stock Paper)",
    slot: "intake-gasket",
    vendor: "bay-mopeds",
    price: 3,
    repRequired: 0,
    compatibleMakes: "all",
    description: "Basic paper intake gasket. Fine when new; old ones shrink and suck air.",
    realVendorUrl: MOPEDS_1977.url,
    realVendorLabel: BUY_LABEL(MOPEDS_1977.label),
    visualTag: "stock",
  },
  {
    id: "gasket-intake-fresh",
    name: "Intake Gasket Kit (Fresh, w/ Sealant)",
    slot: "intake-gasket",
    vendor: "bay-mopeds",
    price: 6,
    repRequired: 0,
    compatibleMakes: "all",
    description:
      "Fresh intake gasket set plus a dab of sealant. Cures surging idle and that high, hunting rpm from an air leak.",
    realVendorUrl: MOPEDS_1977.url,
    realVendorLabel: BUY_LABEL(MOPEDS_1977.label),
    visualTag: "stock",
  },

  // ── CLUTCHES ───────────────────────────────────────────────────────────
  {
    id: "clutch-stock-2shoe",
    name: "Stock 2-Shoe Clutch",
    slot: "clutch",
    vendor: "bay-mopeds",
    price: 30,
    repRequired: 0,
    compatibleMakes: "all",
    description: "Fresh stock clutch shoes and springs. Fixes a glazed, slipping clutch.",
    realVendorUrl: MYRONS.url,
    realVendorLabel: BUY_LABEL(MYRONS.label),
    clutchGrip: 1,
    visualTag: "stock",
  },
  {
    id: "clutch-3shoe-race",
    name: "3-Shoe Race Clutch (Stiff Springs)",
    slot: "clutch",
    vendor: "east-bay-speed",
    price: 85,
    repRequired: 30,
    compatibleMakes: "all",
    description:
      "Three shoes and stiffer springs: engages higher in the rpm range, right where a kitted engine makes power. Hooks up hard.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    clutchGrip: 1.15,
    visualTag: "race",
  },

  // ── BELTS (variator bikes) ─────────────────────────────────────────────
  {
    id: "belt-stock-variator",
    name: "Variator Drive Belt (Stock)",
    slot: "belt",
    vendor: "bay-mopeds",
    price: 18,
    repRequired: 0,
    compatibleMakes: ["honda-hobbit", "derbi-variant"],
    description: "Stock variator belt. Cracked, glazed belts slip under load.",
    realVendorUrl: MYRONS.url,
    realVendorLabel: BUY_LABEL(MYRONS.label),
    clutchGrip: 1,
    visualTag: "stock",
  },
  {
    id: "belt-kevlar-variator",
    name: "Kevlar Variator Belt",
    slot: "belt",
    vendor: "golden-gate-parts",
    price: 35,
    repRequired: 10,
    compatibleMakes: ["honda-hobbit", "derbi-variant"],
    description: "Kevlar-reinforced belt. Holds up to a kitted engine without stretching.",
    realVendorUrl: TREATLAND.url,
    realVendorLabel: BUY_LABEL(TREATLAND.label),
    clutchGrip: 1.06,
    visualTag: "performance",
  },
];

export const ALL_PART_SLOTS: PartSlot[] = [
  "spark-plug",
  "main-jet",
  "carburetor",
  "exhaust",
  "cylinder",
  "air-filter",
  "fuel-filter",
  "ignition",
  "intake-gasket",
  "clutch",
  "belt",
];

/**
 * Slots where installing the same part ID again is a legit fresh replacement
 * (new points, a fresh stock top end) rather than a no-op.
 */
export const SERVICEABLE_SLOTS: PartSlot[] = [
  "spark-plug",
  "fuel-filter",
  "intake-gasket",
  "clutch",
  "belt",
  "ignition",
  "cylinder",
];

/** Slots whose old part gets tossed in the bin instead of returning to the toolbox. */
export const CONSUMABLE_SLOTS: PartSlot[] = [
  "spark-plug",
  "fuel-filter",
  "intake-gasket",
  "clutch",
  "belt",
];

export const INSTRUMENT_UPGRADES: InstrumentSpec[] = [
  {
    id: "gauge-tach",
    name: "Bar-Mount Tachometer",
    price: 45,
    repRequired: 0,
    description:
      "See your rpm. Find out exactly where the pipe kicks in, and spot a slipping clutch (rpm flares, speed doesn't).",
  },
  {
    id: "gauge-cht",
    name: "CHT Gauge (Spark Plug Washer Sensor)",
    price: 55,
    repRequired: 5,
    description:
      "Cylinder head temperature. Lean bikes run hot; above ~200°C you're flirting with detonation and seizing.",
  },
  {
    id: "tool-stethoscope",
    name: "Mechanic's Stethoscope",
    price: 75,
    repRequired: 10,
    description:
      "Unlocks Listen Mode. Hear piston slap, a ticking top end, or a pinging head before it turns into a seize.",
  },
];

export const CRAIGSLIST_LISTINGS: CraigslistListing[] = [
  {
    id: "cl-honda-hobbit",
    make: "honda-hobbit",
    title: "1979 Honda Hobbit PA50 — runs, needs TLC",
    sellerBlurb:
      "Grandpa's old Hobbit. Idles kinda high and it bogs going up hills, probably just needs gas. No lowballers, I know what I have.",
    price: 180,
    repRequired: 0,
    colorHex: "#DC2626",
    accentHex: "#F5F5F4",
    starterFaults: ["air-leak", "clutch-slip"],
  },
  {
    id: "cl-derbi-variant",
    make: "derbi-variant",
    title: "Derbi Variant SL w/ Tecno pipe — FAST",
    sellerBlurb:
      "Put a Tecno pipe on it, super fast. Gets a little hot and cuts out sometimes at full throttle. Cash only, title in hand.",
    price: 260,
    repRequired: 15,
    colorHex: "#2563EB",
    accentHex: "#E5E7EB",
    starterFaults: ["weak-spark", "lean-jet"],
    starterJetOffset: -8,
  },
  {
    id: "cl-tomos-a35",
    make: "tomos-a35",
    title: "Tomos A35 Targa — sat in a garage 6 yrs",
    sellerBlurb:
      "Ran when parked! Sat in the garage since 2019. Kicks over, sputters, sometimes catches. Easy fix I'm sure.",
    price: 220,
    repRequired: 5,
    colorHex: "#16A34A",
    accentHex: "#FAFAF9",
    starterFaults: ["clogged-fuel", "fouled-plug"],
  },
];

const PARTS_BY_ID = new Map(PARTS_CATALOG.map((p) => [p.id, p] as const));

export function getPartById(id: string): PartSpec | undefined {
  return PARTS_BY_ID.get(id);
}

export function getInstrumentById(id: string): InstrumentSpec | undefined {
  return INSTRUMENT_UPGRADES.find((u) => u.id === id);
}

export function getListingById(id: string): CraigslistListing | undefined {
  return CRAIGSLIST_LISTINGS.find((l) => l.id === id);
}

export function isPartCompatible(part: PartSpec, make: SimBikeMake): boolean {
  return part.compatibleMakes === "all" || part.compatibleMakes.includes(make);
}

/** Catalog jet sizes, ascending. */
export const CATALOG_JET_SIZES: number[] = [...JET_SIZES];

/** How many jet sizes each upgrade asks for on top of the stock 60. */
const IDEAL_JET_DELTA: Record<string, number> = {
  "carb-dellorto-15": 4,
  "pipe-tecno-boss": 4,
  "pipe-proma-circuit": 6,
  "cyl-airsal-65": 6,
  "cyl-treat-70": 8,
  "filter-mesh-pod": 2,
};

const MAKE_BASE_JET: Record<SimBikeMake, number> = {
  "puch-maxi": 60,
  "honda-hobbit": 60,
  "derbi-variant": 60,
  "tomos-a35": 60,
};

/**
 * Realistic target main jet for the bike's current hardware.
 * Stock 12mm Bing = 60 → +pipe = 64 → +15mm SHA = 68 → +70cc kit = 76.
 */
export function getIdealJetForBike(bike: OwnedBike): number {
  let ideal = MAKE_BASE_JET[bike.make] ?? 60;
  const slots: (keyof typeof bike.parts)[] = [
    "carburetor",
    "exhaust",
    "cylinder",
    "air-filter",
  ];
  for (const slot of slots) {
    const id = bike.parts[slot];
    if (id) ideal += IDEAL_JET_DELTA[id] ?? 0;
  }
  return ideal;
}

/** Nearest catalog jet size to a requested size. */
export function nearestCatalogJet(size: number): number {
  let best = CATALOG_JET_SIZES[0] ?? 60;
  for (const s of CATALOG_JET_SIZES) {
    if (Math.abs(s - size) < Math.abs(best - size)) best = s;
  }
  return best;
}
