"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Gauge,
  Lock,
  ShoppingBag,
  Stethoscope,
  Thermometer,
  Wrench,
} from "lucide-react";
import {
  PulseSynth,
  loadSimMutedPreference,
} from "@/lib/simulator/audio/pulse-synth";
import type {
  InstrumentSpec,
  PartSlot,
  PartSpec,
  ShopVendorId,
  SimBikeMake,
  UpgradeId,
} from "@/lib/simulator/contract";
import {
  INSTRUMENT_UPGRADES,
  PARTS_CATALOG,
  SERVICEABLE_SLOTS,
} from "@/lib/simulator/economy/catalog";
import { getActiveBike, useSimStore } from "@/lib/simulator/store/sim-store";

type ShopCategory =
  | "all"
  | "tune-jets"
  | "fuel-spark"
  | "performance"
  | "instruments";

const CATEGORY_TABS: Array<{ id: ShopCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "tune-jets", label: "Tune & Jets" },
  { id: "fuel-spark", label: "Fuel & Spark" },
  { id: "performance", label: "Performance" },
  { id: "instruments", label: "Instruments & Tools" },
];

const VENDOR_LABELS: Record<ShopVendorId, string> = {
  "bay-mopeds": "Bay Mopeds",
  "golden-gate-parts": "Golden Gate Parts",
  "east-bay-speed": "East Bay Speed",
};

const MAKE_SHORT: Record<SimBikeMake, string> = {
  "puch-maxi": "Puch Maxi",
  "honda-hobbit": "Honda Hobbit",
  "derbi-variant": "Derbi Variant",
  "tomos-a35": "Tomos A35",
};

const TUNE_SLOTS = new Set<PartSlot>([
  "main-jet",
  "carburetor",
  "air-filter",
  "intake-gasket",
]);
const FUEL_SPARK_SLOTS = new Set<PartSlot>([
  "spark-plug",
  "fuel-filter",
  "ignition",
]);
const PERFORMANCE_SLOTS = new Set<PartSlot>([
  "exhaust",
  "cylinder",
  "clutch",
  "belt",
]);

function partMatchesCategory(part: PartSpec, category: ShopCategory): boolean {
  if (category === "all") return true;
  if (category === "tune-jets") return TUNE_SLOTS.has(part.slot);
  if (category === "fuel-spark") return FUEL_SPARK_SLOTS.has(part.slot);
  if (category === "performance") return PERFORMANCE_SLOTS.has(part.slot);
  return false;
}

function getPartStatChips(part: PartSpec): string[] {
  const chips: string[] = [];
  if (typeof part.jetSize === "number") chips.push(`Jet #${part.jetSize}`);
  if (typeof part.torqueMult === "number" && part.torqueMult !== 1) {
    const pct = Math.round((part.torqueMult - 1) * 100);
    chips.push(`Torque ${pct >= 0 ? "+" : ""}${pct}%`);
  }
  if (typeof part.airflowMult === "number" && part.airflowMult !== 1) {
    const pct = Math.round((part.airflowMult - 1) * 100);
    chips.push(`Airflow ${pct >= 0 ? "+" : ""}${pct}%`);
  }
  if (typeof part.powerbandRpm === "number") {
    chips.push(`Peak ${part.powerbandRpm} RPM`);
  }
  if (typeof part.maxRpmBonus === "number" && part.maxRpmBonus > 0) {
    chips.push(`+${part.maxRpmBonus} Max RPM`);
  }
  if (typeof part.coolingBonus === "number" && part.coolingBonus > 0) {
    chips.push(`Cooling +${Math.round(part.coolingBonus * 100)}%`);
  }
  if (typeof part.sparkBonus === "number" && part.sparkBonus > 0) {
    chips.push(`Spark +${Math.round(part.sparkBonus * 100)}%`);
  }
  if (typeof part.compressionBonus === "number" && part.compressionBonus > 0) {
    chips.push(`Compression +${Math.round(part.compressionBonus * 100)}%`);
  }
  if (typeof part.clutchGrip === "number" && part.clutchGrip > 1) {
    chips.push(`Grip +${Math.round((part.clutchGrip - 1) * 100)}%`);
  }
  return chips;
}

function instrumentIcon(id: UpgradeId) {
  if (id === "gauge-tach") return Gauge;
  if (id === "gauge-cht") return Thermometer;
  return Stethoscope;
}

export function PartsCounter() {
  const { save, buyPart, buyUpgrade, installPart, setPhase } = useSimStore();
  const bike = getActiveBike(save);
  const [category, setCategory] = useState<ShopCategory>("all");
  const [compatibleOnly, setCompatibleOnly] = useState(false);
  const synthRef = useRef<PulseSynth | null>(null);

  useEffect(() => {
    return () => {
      synthRef.current?.destroy();
      synthRef.current = null;
    };
  }, []);

  const handleInstallPart = (partId: string) => {
    if (!installPart(partId)) return;
    synthRef.current ??= new PulseSynth(loadSimMutedPreference());
    synthRef.current.setMuted(loadSimMutedPreference());
    synthRef.current.unlock();
    synthRef.current.playGarage("install");
  };

  const showInstruments = category === "all" || category === "instruments";
  const showParts = category !== "instruments";

  const filteredParts = showParts
    ? PARTS_CATALOG.filter((part) => {
        if (!partMatchesCategory(part, category)) return false;
        if (
          compatibleOnly &&
          part.compatibleMakes !== "all" &&
          !part.compatibleMakes.includes(bike.make)
        ) {
          return false;
        }
        return true;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-4 border-[#FFD700] bg-zinc-950 p-5 shadow-[6px_6px_0px_0px_#FFD700]">
        <div>
          <span className="inline-flex items-center gap-1.5 border-2 border-[#FFD700] bg-[#FFD700] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-black">
            <ShoppingBag className="h-3.5 w-3.5" aria-hidden="true" />
            East Bay Moped Parts Counter
          </span>
          <h2
            className="mt-2 text-4xl tracking-wider text-[#FFD700] sm:text-5xl"
            style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
          >
            JETS, PIPES, KITS &amp; GAUGES
          </h2>
          <p className="mt-1 text-sm text-zinc-300">
            Shopping for{" "}
            <strong className="text-white">{bike.nickname}</strong> (
            {MAKE_SHORT[bike.make]}). Parts you buy go straight to your garage
            toolbox — install them right here or back on the workbench.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPhase("GARAGE")}
          className="inline-flex items-center gap-2 border-2 border-zinc-500 bg-black px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Back to Garage
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-zinc-800 bg-zinc-950 p-3">
        <div
          role="group"
          aria-label="Parts category filter"
          className="flex flex-wrap gap-1.5"
        >
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(tab.id)}
                className={`border-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                  active
                    ? "border-[#FFD700] bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_#FFF]"
                    : "border-zinc-700 bg-black text-zinc-300 hover:border-[#FFD700] hover:text-[#FFD700]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {showParts && (
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wide text-zinc-300">
            <input
              type="checkbox"
              checked={compatibleOnly}
              onChange={(e) => setCompatibleOnly(e.target.checked)}
              className="h-4 w-4 accent-[#FFD700]"
            />
            Fits {MAKE_SHORT[bike.make]} only
          </label>
        )}
      </div>

      {/* Instruments & Tools Section */}
      {showInstruments && (
        <section aria-label="Instruments and diagnostic tools" className="space-y-3">
          <h3
            className="text-lg font-bold uppercase tracking-wider text-[#FFD700]"
            style={{
              fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
            }}
          >
            Instruments &amp; Garage Tools
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {INSTRUMENT_UPGRADES.map((spec: InstrumentSpec) => {
              const Icon = instrumentIcon(spec.id);
              const owned = save.upgrades.includes(spec.id);
              const repLocked = save.rep < spec.repRequired;
              const canAfford = save.cash >= spec.price;

              return (
                <article
                  key={spec.id}
                  className={`flex flex-col justify-between border-4 bg-zinc-950 p-4 ${
                    owned
                      ? "border-emerald-500/80"
                      : "border-zinc-700 hover:border-[#FFD700]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 border-2 border-cyan-500/70 bg-cyan-950/50 px-2 py-0.5 text-[10px] font-black uppercase text-cyan-200">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        Permanent Upgrade
                      </span>
                      <span
                        className="text-lg font-bold text-[#FFD700] tabular-nums"
                        style={{
                          fontFamily:
                            "var(--font-orbitron), Orbitron, monospace",
                        }}
                      >
                        ${spec.price}
                      </span>
                    </div>

                    <h4 className="mt-2.5 text-base font-black uppercase text-white">
                      {spec.name}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                      {spec.description}
                    </p>
                  </div>

                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    {owned ? (
                      <div className="flex items-center justify-center gap-1.5 border-2 border-emerald-500 bg-emerald-950/60 py-2 text-xs font-black uppercase text-emerald-200">
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Owned &amp; Active
                      </div>
                    ) : repLocked ? (
                      <div className="flex items-center justify-center gap-1.5 border-2 border-zinc-700 bg-zinc-900 py-2 text-xs font-black uppercase text-zinc-400">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        Requires {spec.repRequired} Rep
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => buyUpgrade(spec.id)}
                        className="w-full border-2 border-[#FFD700] bg-[#FFD700] py-2 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                      >
                        {canAfford
                          ? `Buy Instrument ($${spec.price})`
                          : `Need $${spec.price - save.cash} More`}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Hardware Parts Grid */}
      {showParts && (
        <section aria-label="Moped parts catalog" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3
              className="text-lg font-bold uppercase tracking-wider text-[#FFD700]"
              style={{
                fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
              }}
            >
              Parts Shelf ({filteredParts.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredParts.map((part) => {
              const isInstalled = bike.parts[part.slot] === part.id;
              const ownedInInventory = save.inventory.filter(
                (id) => id === part.id,
              ).length;
              const isServiceable = SERVICEABLE_SLOTS.includes(part.slot);
              const allowExtraCopy = !isServiceable && save.bikes.length > 1;
              const isOwned = isInstalled || ownedInInventory > 0;
              const isCompatible =
                part.compatibleMakes === "all" ||
                part.compatibleMakes.includes(bike.make);
              const repLocked = save.rep < part.repRequired;
              const canAfford = save.cash >= part.price;
              const statChips = getPartStatChips(part);

              return (
                <article
                  key={part.id}
                  className={`flex flex-col justify-between border-4 bg-zinc-950 p-4 transition-colors ${
                    isInstalled
                      ? "border-emerald-500/80"
                      : isOwned
                        ? "border-cyan-500/70"
                        : "border-zinc-800 hover:border-[#FFD700]"
                  }`}
                >
                  <div>
                    {/* Top badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span className="border border-zinc-700 bg-black px-2 py-0.5 text-[10px] font-black uppercase text-zinc-300">
                          {VENDOR_LABELS[part.vendor]}
                        </span>
                        <span className="border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-black uppercase text-[#FFD700]">
                          {part.slot.replace("-", " ")}
                        </span>
                        {part.visualTag && part.visualTag !== "stock" && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black uppercase ${
                              part.visualTag === "race"
                                ? "bg-[#FFD700] text-black"
                                : "bg-cyan-400 text-black"
                            }`}
                          >
                            {part.visualTag}
                          </span>
                        )}
                      </div>
                      <span
                        className="shrink-0 text-lg font-bold text-[#FFD700] tabular-nums"
                        style={{
                          fontFamily:
                            "var(--font-orbitron), Orbitron, monospace",
                        }}
                      >
                        ${part.price}
                      </span>
                    </div>

                    <h4 className="mt-2.5 text-base font-black text-white">
                      {part.name}
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-300">
                      {part.description}
                    </p>

                    {/* Stat modifiers */}
                    {statChips.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {statChips.map((chip) => (
                          <span
                            key={chip}
                            className="border border-zinc-700 bg-black px-2 py-0.5 text-[10px] font-bold uppercase text-cyan-300"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Compatibility + Rep */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
                      {isCompatible ? (
                        <span className="text-emerald-400">
                          &bull; Fits {MAKE_SHORT[bike.make]}
                        </span>
                      ) : (
                        <span className="text-orange-400">
                          &bull; Fits{" "}
                          {part.compatibleMakes === "all"
                            ? "All"
                            : part.compatibleMakes
                                .map((m) => MAKE_SHORT[m])
                                .join(", ")}
                        </span>
                      )}
                      {part.repRequired > 0 && (
                        <span
                          className={
                            repLocked ? "text-red-400" : "text-zinc-400"
                          }
                        >
                          &bull; Rep {part.repRequired}+
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions & Real Vendor Link */}
                  <div className="mt-4 space-y-2 border-t border-zinc-800 pt-3">
                    {isInstalled ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-1.5 border-2 border-emerald-500 bg-emerald-950/60 py-1.5 text-xs font-black uppercase text-emerald-200">
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          <span>
                            Installed on Bike
                            {ownedInInventory > 0
                              ? ` (${ownedInInventory} Spare${ownedInInventory === 1 ? "" : "s"})`
                              : ""}
                          </span>
                        </div>

                        {isServiceable ? (
                          <div className="space-y-1.5">
                            {ownedInInventory > 0 && isCompatible && (
                              <button
                                type="button"
                                onClick={() => handleInstallPart(part.id)}
                                className="w-full border-2 border-cyan-400 bg-cyan-950/60 py-2 text-xs font-black uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-400 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                              >
                                Install Fresh (From Toolbox)
                              </button>
                            )}
                            {repLocked ? (
                              <div className="flex items-center justify-center gap-1.5 border-2 border-zinc-700 bg-zinc-900 py-1.5 text-[11px] font-black uppercase text-zinc-400">
                                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                                Requires {part.repRequired} Rep to Buy More
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={!canAfford}
                                  onClick={() => buyPart(part.id)}
                                  className="flex-1 border-2 border-[#FFD700] bg-[#FFD700] py-2 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                                >
                                  {canAfford
                                    ? `Buy Fresh ($${part.price})`
                                    : `Need $${part.price - save.cash}`}
                                </button>
                                {isCompatible && canAfford && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (buyPart(part.id)) {
                                        handleInstallPart(part.id);
                                      }
                                    }}
                                    className="border-2 border-white bg-black px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                                  >
                                    Buy &amp; Install
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          allowExtraCopy &&
                          !repLocked && (
                            <button
                              type="button"
                              disabled={!canAfford}
                              onClick={() => buyPart(part.id)}
                              className="w-full border-2 border-zinc-600 bg-black py-1.5 text-xs font-black uppercase tracking-wider text-zinc-100 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                            >
                              {canAfford
                                ? `Buy Extra for Garage ($${part.price})`
                                : `Need $${part.price - save.cash}`}
                            </button>
                          )
                        )}
                      </div>
                    ) : ownedInInventory > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="border-2 border-cyan-500/60 bg-cyan-950/40 px-2.5 py-2 text-[11px] font-black uppercase text-cyan-200">
                            Owned ({ownedInInventory})
                          </span>
                          <button
                            type="button"
                            disabled={!isCompatible}
                            onClick={() => handleInstallPart(part.id)}
                            className="flex-1 border-2 border-[#FFD700] bg-[#FFD700] py-2 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                          >
                            {isCompatible
                              ? isServiceable
                                ? "Install Fresh"
                                : "Install Now"
                              : "Wrong Make"}
                          </button>
                        </div>
                        {(isServiceable || allowExtraCopy) && !repLocked && (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => buyPart(part.id)}
                            className="w-full border-2 border-zinc-600 bg-black py-1.5 text-xs font-black uppercase tracking-wider text-zinc-100 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                          >
                            {canAfford
                              ? isServiceable
                                ? `Buy Fresh Spare ($${part.price})`
                                : `Buy Extra for Garage ($${part.price})`
                              : `Need $${part.price - save.cash}`}
                          </button>
                        )}
                      </div>
                    ) : repLocked ? (
                      <div className="flex items-center justify-center gap-1.5 border-2 border-zinc-700 bg-zinc-900 py-2 text-xs font-black uppercase text-zinc-400">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        Requires {part.repRequired} Rep
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => buyPart(part.id)}
                          className="flex-1 border-2 border-[#FFD700] bg-[#FFD700] py-2 text-xs font-black uppercase tracking-wider text-black transition-colors hover:bg-yellow-300 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                        >
                          {canAfford
                            ? `Buy ($${part.price})`
                            : `Need $${part.price - save.cash}`}
                        </button>
                        {isCompatible && canAfford && (
                          <button
                            type="button"
                            onClick={() => {
                              if (buyPart(part.id)) {
                                handleInstallPart(part.id);
                              }
                            }}
                            className="border-2 border-white bg-black px-3 py-2 text-xs font-black uppercase tracking-wider text-white transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                          >
                            Buy &amp; Install
                          </button>
                        )}
                      </div>
                    )}

                    {part.realVendorUrl && (
                      <a
                        href={part.realVendorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between border border-zinc-800 bg-black px-2.5 py-1.5 text-[11px] font-bold text-zinc-300 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                      >
                        <span>
                          {part.realVendorLabel ?? "Buy the real one →"}
                        </span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
