// Diegetic diagnostic tools for Ran When Parked.
//
// Every reading is something a real mechanic would observe — a plug's color,
// a spark's color, a psi number, an rpm jump. Readings NEVER contain internal
// FaultIds; players deduce the problem from the clues.

import type { HotspotId, OwnedBike, ToolId, ToolReading, ToolSpec } from "../contract";
import { getPartById } from "../economy/catalog";
import { AIR_FILTER_DIRT_THRESHOLD, buildBikeProfile, effectiveSpark } from "../engine/engine-sim";
import { getJetDeviation, getFault, hasFault } from "../faults/catalog";

export const DIAGNOSTIC_TOOLS: ToolSpec[] = [
  {
    id: "visual",
    name: "Eyeballs & Flashlight",
    shortLabel: "Look",
    description: "Get down on the garage floor and look closely. Drips, soot, glazing, loose boots.",
    validHotspots: [
      "spark-plug",
      "cylinder",
      "carburetor",
      "intake-gasket",
      "fuel-filter",
      "exhaust",
      "ignition",
      "clutch",
      "gas-tank",
      "rear-wheel",
    ],
  },
  {
    id: "plug-chop",
    name: "Plug Wrench (Read the Plug)",
    shortLabel: "Plug",
    description:
      "Pull the spark plug and read its color. Tan = happy. Black & wet = rich. White = lean and hot. For the truest read, hold the kill switch at full throttle on a ride.",
    validHotspots: ["spark-plug"],
  },
  {
    id: "spark-tester",
    name: "Inline Spark Tester",
    shortLabel: "Spark",
    description: "Clip it between the plug cap and plug, kick it over, watch the gap. You want a fat blue snap.",
    validHotspots: ["spark-plug", "ignition"],
  },
  {
    id: "carb-spray",
    name: "Carb Cleaner Spray Test",
    shortLabel: "Spray",
    description:
      "With the engine idling, spritz carb cleaner around the intake joints. If the rpm jumps, it's sucking that spray in through a leak.",
    validHotspots: ["intake-gasket", "carburetor"],
  },
  {
    id: "compression-gauge",
    name: "Compression Gauge",
    shortLabel: "PSI",
    description: "Thread it into the plug hole, hold the throttle open, kick 5 times. Healthy 50cc: 115–135 psi.",
    validHotspots: ["cylinder", "spark-plug"],
  },
  {
    id: "fuel-flow",
    name: "Fuel Flow Check",
    shortLabel: "Flow",
    description: "Pop the fuel line off at the carb, open the petcock, and watch it flow into a cup.",
    validHotspots: ["fuel-filter", "carburetor"],
  },
  {
    id: "clutch-check",
    name: "Clutch Inspection",
    shortLabel: "Clutch",
    description: "Pull the clutch cover and inspect the shoes, springs and bell.",
    validHotspots: ["clutch", "rear-wheel"],
  },
  {
    id: "premix-check",
    name: "Tank Sniff & Drip Test",
    shortLabel: "Premix",
    description: "Pop the gas cap, sniff, and drip some fuel on white paper. Premix leaves a blue-tinted oily ring.",
    validHotspots: ["gas-tank"],
  },
];

export function getToolById(id: ToolId): ToolSpec | undefined {
  return DIAGNOSTIC_TOOLS.find((t) => t.id === id);
}

// Deterministic per-bike jitter so readings don't feel canned but stay stable.
function jitter(bike: OwnedBike, salt: number, span: number): number {
  let h = 2166136261 ^ salt;
  const key = `${bike.id}:${bike.odometerM | 0}:${bike.wear.pistonScore | 0}`;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (((h >>> 0) % 1000) / 1000) * span;
}

const PLUG_TEXT: Record<
  NonNullable<ToolReading["plugColor"]>,
  { headline: string; detail: string; severity: ToolReading["severity"]; note: string }
> = {
  "tan-ideal": {
    headline: "Plug is a nice coffee-tan",
    detail: "Light brown insulator, dry, no blistering. That's a happy, well-jetted engine.",
    severity: "ok",
    note: "Plug read: coffee-tan. Jetting looks right.",
  },
  "black-wet": {
    headline: "Plug is BLACK and WET",
    detail:
      "The insulator is coated in wet black gunk and it smells like raw fuel. Way too much fuel is getting in — or it isn't being lit.",
    severity: "clue",
    note: "Plug read: black & wet. Too much fuel (or no spark to burn it).",
  },
  "black-sooty": {
    headline: "Plug is dry black soot",
    detail:
      "Fluffy dry carbon on the insulator. A bit rich — or the spark isn't strong enough to burn everything cleanly.",
    severity: "clue",
    note: "Plug read: dry sooty black. Slightly rich or a weak burn.",
  },
  "white-lean": {
    headline: "Plug is chalky white",
    detail:
      "Bone-white insulator with no color at all. It's running lean — starving for fuel at full throttle — and it's running HOT.",
    severity: "danger",
    note: "Plug read: chalky white. Lean and hot under load.",
  },
  "white-blistered": {
    headline: "Plug is WHITE and BLISTERED",
    detail:
      "White insulator with tiny glassy bubbles and a peppered electrode. That's detonation heat. This engine is one hill away from seizing.",
    severity: "danger",
    note: "Plug read: white & blistered. Dangerously lean — detonation!",
  },
  "oily-fouled": {
    headline: "Plug is oily and fouled",
    detail:
      "Shiny oily deposits bridging toward the gap. This plug is cooked — it'll misfire and stall no matter how the carb is set.",
    severity: "clue",
    note: "Plug read: oily & fouled. That plug is done.",
  },
  "dry-clean": {
    headline: "Plug looks almost brand new",
    detail:
      "Clean, dry, barely any color. Either it hasn't run on this plug yet — or there's no oil in the fuel leaving any residue at all.",
    severity: "ok",
    note: "Plug read: dry and clean. Ride it, then read it again.",
  },
};

function invalid(tool: ToolId, hotspot: HotspotId): ToolReading {
  const spec = getToolById(tool);
  return {
    tool,
    hotspot,
    headline: "Not much to learn here",
    detail: `The ${spec?.name ?? "tool"} doesn't really work on that part. Try ${
      spec?.validHotspots.map((h) => h.replace(/-/g, " ")).join(", ") ?? "somewhere else"
    }.`,
    severity: "ok",
    journalNote: "",
  };
}

/** Read a diagnostic tool on a hotspot. Pure; never mutates the bike. */
export function readTool(tool: ToolId, hotspot: HotspotId, bike: OwnedBike): ToolReading {
  const spec = getToolById(tool);
  if (!spec?.validHotspots.includes(hotspot)) return invalid(tool, hotspot);
  const profile = buildBikeProfile(bike);
  const e = profile.effects;

  switch (tool) {
    case "plug-chop": {
      const color = bike.lastPlugColor;
      const t = PLUG_TEXT[color];
      return {
        tool,
        hotspot,
        headline: t.headline,
        detail: `${t.detail} (This is how the plug looks after its last run — after changing jetting, ride it and read it again.)`,
        severity: t.severity,
        plugColor: color,
        journalNote: t.note,
      };
    }

    case "spark-tester": {
      if (bike.tuning.killSwitchOn) {
        return {
          tool,
          hotspot,
          headline: "Nothing. Not even a flicker.",
          detail:
            "Kicked it five times — the tester gap stays dark. Wait… the kill switch on the handlebar is flipped to OFF.",
          severity: "danger",
          sparkQuality: "none",
          journalNote: "No spark — the kill switch was in the OFF position.",
        };
      }
      const spark = effectiveSpark(profile);
      if (spark <= 0.01 || hasFault(bike, "no-spark")) {
        return {
          tool,
          hotspot,
          headline: "No spark at all",
          detail:
            "The tester stays dark no matter how hard you kick. Kill switch is ON (run). Points, condenser, coil or a dead plug — the ignition chain is broken somewhere.",
          severity: "danger",
          sparkQuality: "none",
          journalNote: "No spark with the kill switch in RUN. Ignition or plug.",
        };
      }
      if (spark < 0.75) {
        return {
          tool,
          hotspot,
          headline: "Weak, skinny orange spark",
          detail:
            "There's a spark, but it's thin, orange and lazy. It'll light at low rpm but break up when the engine revs. Pitted points, a tired plug, or crusty kill switch contacts can all do this.",
          severity: "clue",
          sparkQuality: "weak-orange",
          journalNote: "Spark tester: weak orange spark. Expect high-rpm breakup.",
        };
      }
      return {
        tool,
        hotspot,
        headline: "Fat blue spark",
        detail: "Snap! A bright, fat blue spark every kick. Ignition is healthy.",
        severity: "ok",
        sparkQuality: "fat-blue",
        journalNote: "Spark tester: fat blue spark. Ignition is fine.",
      };
    }

    case "carb-spray": {
      if (bike.tuning.killSwitchOn || effectiveSpark(profile) <= 0) {
        return {
          tool,
          hotspot,
          headline: "Can't run the spray test",
          detail: "You need the engine idling for a spray test, and it won't fire.",
          severity: "ok",
          rpmDelta: 0,
          journalNote: "",
        };
      }
      if (hasFault(bike, "air-leak")) {
        const delta = Math.round(930 + jitter(bike, 7, 40)); // ≈ +950 rpm
        return {
          tool,
          hotspot,
          headline: `RPM jumps +${delta}!`,
          detail:
            hotspot === "intake-gasket"
              ? "The second the spray hits the intake gasket, the idle surges way up. It's sucking the spray in — there's an air leak at that joint."
              : "Spraying around the carb mount makes the idle surge. Something near the intake is pulling in air.",
          severity: "danger",
          rpmDelta: delta,
          journalNote: `Carb spray at ${hotspot.replace(/-/g, " ")}: rpm jumped +${delta}. Air leak!`,
        };
      }
      return {
        tool,
        hotspot,
        headline: "Idle doesn't change",
        detail: "You fog the joints with spray — the idle holds steady. The intake is sealed.",
        severity: "ok",
        rpmDelta: 0,
        journalNote: "Carb spray: no rpm change. Intake is sealed.",
      };
    }

    case "compression-gauge": {
      const compression = e.compression;
      if (compression < 0.72) {
        const psi = Math.round(62 + jitter(bike, 11, 16));
        return {
          tool,
          hotspot,
          headline: `${psi} psi — low`,
          detail:
            "The needle barely climbs. Healthy is 115–135 psi. The rings or piston are scored and pressure is leaking past — the kickstart feels mushy for a reason.",
          severity: "danger",
          compressionPsi: psi,
          journalNote: `Compression: ${psi} psi (healthy is 115–135). Top end is worn.`,
        };
      }
      const psi = Math.round(
        Math.min(135, 115 + jitter(bike, 13, 12) + profile.compressionBonus * 60 - (1 - compression) * 30),
      );
      return {
        tool,
        hotspot,
        headline: `${psi} psi — healthy`,
        detail: "Strong, snappy compression. The top end is in good shape.",
        severity: "ok",
        compressionPsi: Math.max(115, psi),
        journalNote: `Compression: ${Math.max(115, psi)} psi. Top end is healthy.`,
      };
    }

    case "fuel-flow": {
      const sev = getFault(bike, "clogged-fuel")?.severity ?? 0;
      if (hasFault(bike, "clogged-fuel")) {
        const drip = sev > 0.75 ? "none" : "trickle";
        return {
          tool,
          hotspot,
          headline: drip === "none" ? "Barely a drop" : "Just a slow trickle",
          detail:
            drip === "none"
              ? "Petcock open, and… a drop. Then nothing. The inline filter is full of brown varnish and rust flakes."
              : "It dribbles out in a thin, slow trickle. Plenty for idling, but under load the float bowl will run dry. The filter looks dark and gummy.",
          severity: "danger",
          dripRate: drip,
          journalNote:
            drip === "none"
              ? "Fuel flow: barely a drop. Fuel delivery is choked off."
              : "Fuel flow: slow trickle. Bowl will starve under load.",
        };
      }
      return {
        tool,
        hotspot,
        headline: "Steady flow",
        detail: "A nice steady stream of fuel fills the cup. Delivery is good.",
        severity: "ok",
        dripRate: "steady",
        journalNote: "Fuel flow: steady stream. Fuel delivery is fine.",
      };
    }

    case "clutch-check": {
      if (hasFault(bike, "clutch-slip")) {
        return {
          tool,
          hotspot,
          headline: "Glazed shoes, tired springs",
          detail:
            "The clutch shoes are shiny and glazed, the bell is blued from heat, and the springs feel weak. It'll slip under load — revs flare but the bike doesn't pull.",
          severity: "danger",
          journalNote: "Clutch: glazed shoes & weak springs. It's slipping.",
        };
      }
      const worn = bike.wear.clutchWear > 45;
      return {
        tool,
        hotspot,
        headline: worn ? "Some wear, still grabbing" : "Clutch looks good",
        detail: worn
          ? "Shoes have some wear and a little dust, but plenty of material left."
          : "Shoes have plenty of material, springs are snappy, the bell is clean.",
        severity: "ok",
        journalNote: worn ? "Clutch: some wear, still OK." : "Clutch: healthy.",
      };
    }

    case "premix-check": {
      if (!bike.tuning.hasPremixOil) {
        return {
          tool,
          hotspot,
          headline: "Smells like straight gas!",
          detail:
            "The drip on white paper evaporates clean — no blue tint, no oily ring. There's NO 2-stroke oil in this tank. Riding on this will seize the piston.",
          severity: "danger",
          journalNote: "Tank check: straight gas, no premix oil! Must mix 50:1.",
        };
      }
      return {
        tool,
        hotspot,
        headline: "Blue-tinted premix",
        detail: "Sweet 2-stroke smell and a faint blue oily ring on the paper. Mixed about 50:1.",
        severity: "ok",
        journalNote: "Tank check: properly premixed.",
      };
    }

    case "visual":
      return visualReading(bike, hotspot);

    default:
      return invalid(tool, hotspot);
  }
}

function visualReading(bike: OwnedBike, hotspot: HotspotId): ToolReading {
  const profile = buildBikeProfile(bike);
  const e = profile.effects;
  const dev = getJetDeviation(bike);
  const base = { tool: "visual" as const, hotspot };
  const ok = (headline: string, detail: string): ToolReading => ({
    ...base,
    headline,
    detail,
    severity: "ok",
    journalNote: "",
  });
  const clue = (headline: string, detail: string, note: string, danger = false): ToolReading => ({
    ...base,
    headline,
    detail,
    severity: danger ? "danger" : "clue",
    journalNote: note,
  });

  switch (hotspot) {
    case "exhaust":
      if (dev >= 6)
        return clue(
          "Dark, oily exhaust tip",
          "The tailpipe is dripping black oily spooge and there's soot streaked down the muffler. Something's dumping in more fuel than it burns.",
          "Exhaust tip: black oily spooge. Running rich?",
        );
      if (dev <= -6)
        return clue(
          "Exhaust tip is light grey",
          "The end of the pipe is dry and pale grey, and the header looks a little heat-discolored.",
          "Exhaust tip: pale & dry, header discolored. Running lean/hot?",
        );
      if (!bike.tuning.hasPremixOil)
        return clue(
          "Bone-dry tailpipe",
          "Not a trace of oily residue at the tailpipe. A two-stroke pipe is never this clean.",
          "Exhaust tip: totally dry, no oil residue at all.",
        );
      return ok("Exhaust looks normal", "A light brown film at the tip. No cracks or blown gaskets.");

    case "carburetor":
      if (dev >= 8)
        return clue(
          "Carb float bowl is wet",
          "Fuel is weeping from the float bowl overflow and the intake is wet. It's getting more fuel than it can use.",
          "Carb: weeping fuel, wet intake.",
        );
      if (hasFault(bike, "air-leak"))
        return clue(
          "Carb wiggles on the manifold",
          "Grab the carb and it shifts a little on the intake. The clamp is snug but the gasket underneath looks shrunken.",
          "Carb mount: wiggles; intake gasket looks shrunken.",
        );
      if ((bike.wear.airFilterDirt ?? 0) >= AIR_FILTER_DIRT_THRESHOLD)
        return clue(
          "Air filter is caked in dust",
          `The filter element on the carb mouth is grey with East Bay road dust — you can barely see through it. Jet stamped #${bike.tuning.mainJet}, needle clip in position ${bike.tuning.needleClip}.`,
          "Carb: air filter caked with dust — it's choking on air.",
        );
      return ok(
        "Carb looks clean",
        `Clean, dry body. Jet stamped #${bike.tuning.mainJet}, needle clip in position ${bike.tuning.needleClip}.`,
      );

    case "intake-gasket":
      if (hasFault(bike, "air-leak"))
        return clue(
          "Cracked, shrunken gasket",
          "The paper gasket is brittle and pulled back from the edge — there's a visible gap at the joint. Air is getting in here.",
          "Intake gasket: cracked and gapped.",
          true,
        );
      return ok("Gasket looks sealed", "The intake gasket is flush and intact.");

    case "spark-plug":
      if (e.plugFoul > 0.5)
        return clue(
          "Plug cap is oily",
          "Oil around the plug threads and the cap. Pull the plug and read it.",
          "Plug area is oily — worth pulling the plug.",
        );
      return ok("Plug cap is snug", `${getPartById(bike.parts["spark-plug"])?.name ?? "Spark plug"} installed, cap seated firmly.`);

    case "ignition":
      if (bike.tuning.killSwitchOn)
        return clue(
          "Kill switch is OFF",
          "The handlebar kill switch is flipped to the OFF position. Nothing's going to fire like that.",
          "Kill switch is in the OFF position!",
          true,
        );
      if (hasFault(bike, "weak-spark") || hasFault(bike, "no-spark"))
        return clue(
          "Crusty contacts",
          "The points are pitted and the kill switch contacts under the bar housing are green and crusty.",
          "Ignition: pitted points, crusty kill switch contacts.",
        );
      return ok("Ignition looks tidy", "Points look clean, wires intact, kill switch in RUN.");

    case "fuel-filter":
      if (hasFault(bike, "clogged-fuel"))
        return clue(
          "Filter is dark brown",
          "The inline filter is dark with varnish and there are rust flakes floating in it. Old tank gunk.",
          "Fuel filter: dark brown, full of rust flakes.",
          true,
        );
      return ok("Filter looks clear", "The inline filter is clean and you can see fuel in it.");

    case "gas-tank":
      if (!bike.tuning.hasPremixOil)
        return clue(
          "Fuel looks clear as water",
          "Shine a light in the tank — the fuel is perfectly clear, not the usual tinted premix color.",
          "Tank fuel looks perfectly clear (no oil tint?).",
          true,
        );
      return ok("Tank is fine", "Tinted premix, no rust, cap vent clear.");

    case "cylinder":
      if (e.compression < 0.72)
        return clue(
          "Oily weep at the head",
          "There's oily black residue around the head gasket and the cylinder fins. Combustion pressure is escaping somewhere.",
          "Cylinder: oily blow-by residue at the head.",
        );
      return ok("Cylinder looks fine", "Fins are clean, no oily weeping at the head gasket.");

    case "clutch":
      if (hasFault(bike, "clutch-slip"))
        return clue(
          "Burnt smell from the clutch cover",
          "The clutch cover smells like burnt brake pads and there's fine dust around the vent.",
          "Clutch cover: burnt smell, dust at vent.",
        );
      return ok("Clutch cover is clean", "No smell, no dust.");

    case "rear-wheel":
      if (hasFault(bike, "clutch-slip"))
        return clue(
          "Drive feels soft",
          "On the stand, give it gas — the wheel spins up lazily and you can stop it with a gloved hand while the engine keeps revving.",
          "Rear wheel: easy to stall by hand while revving. Drive slipping.",
        );
      return ok("Wheel spins true", "Chain tension is good, the wheel spins true, brakes drag a hair.");

    default:
      return ok("Looks fine", "Nothing stands out.");
  }
}

/** Quick "is this tool useful on this hotspot" check for UIs. */
export function toolWorksOn(tool: ToolId, hotspot: HotspotId): boolean {
  return getToolById(tool)?.validHotspots.includes(hotspot) ?? false;
}
