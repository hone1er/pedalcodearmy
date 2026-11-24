"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Droplets,
  Eye,
  Flame,
  Gauge,
  Lock,
  MapPin,
  Minus,
  Plus,
  Power,
  ShoppingBag,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import type {
  HotspotId,
  PartSlot,
  PartSpec,
  PlugColor,
  ToolReading,
} from "@/lib/simulator/contract";
import { DIAGNOSTIC_TOOLS, getToolById } from "@/lib/simulator/diagnostics/tools";
import {
  getPartById,
  PARTS_CATALOG,
  SERVICEABLE_SLOTS,
} from "@/lib/simulator/economy/catalog";
import { getActiveBike, useSimStore } from "@/lib/simulator/store/sim-store";
import { MopedWorkbench } from "./moped-workbench";
import { PlugViewer } from "./plug-viewer";

const HOTSPOT_LABELS: Record<HotspotId, string> = {
  "spark-plug": "Spark Plug",
  cylinder: "Cylinder",
  carburetor: "Carburetor",
  "intake-gasket": "Intake Gasket",
  "fuel-filter": "Fuel Filter",
  exhaust: "Exhaust",
  ignition: "Ignition",
  clutch: "Clutch",
  "gas-tank": "Gas Tank",
  "rear-wheel": "Rear Wheel",
};

const HARDWARE_SLOTS: Array<{ slot: PartSlot; label: string }> = [
  { slot: "spark-plug", label: "Spark Plug" },
  { slot: "carburetor", label: "Carburetor" },
  { slot: "exhaust", label: "Exhaust Pipe" },
  { slot: "cylinder", label: "Cylinder Kit" },
  { slot: "air-filter", label: "Air Filter" },
  { slot: "fuel-filter", label: "Fuel Filter" },
  { slot: "ignition", label: "Ignition" },
  { slot: "intake-gasket", label: "Intake Gasket" },
  { slot: "clutch", label: "Clutch" },
  { slot: "belt", label: "Drive Belt" },
];

const HARDWARE_SLOT_SET = new Set<PartSlot>(HARDWARE_SLOTS.map((s) => s.slot));

const NEEDLE_CLIPS: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

function severityStyles(severity: ToolReading["severity"]): string {
  if (severity === "danger") {
    return "border-red-500 bg-red-950/50 text-red-100";
  }
  if (severity === "clue") {
    return "border-[#FFD700] bg-[#FFD700]/10 text-yellow-100";
  }
  return "border-emerald-400 bg-emerald-950/40 text-emerald-100";
}

export function GarageView() {
  const store = useSimStore();
  const {
    save,
    selectedTool,
    lastToolReading,
    plugViewerColor,
    garageFuelDrip,
    bikeNeedsAttention,
    jetRange,
    selectBike,
    selectTool,
    runToolOnHotspot,
    closePlugViewer,
    installPart,
    setMainJet,
    setNeedleClip,
    setIdleScrew,
    toggleKillSwitch,
    addPremixOil,
    cleanAirFilter,
    cleanCarburetor,
    setPhase,
  } = store;

  const bike = getActiveBike(save);
  const [localPlugPreview, setLocalPlugPreview] = useState<PlugColor | null>(
    null,
  );
  const [rightBottomTab, setRightBottomTab] = useState<"journal" | "badges">(
    "journal",
  );

  const activeToolSpec = getToolById(selectedTool);
  const hasStethoscope = save.upgrades.includes("tool-stethoscope");

  // Gather owned main jets (+ currently installed jet) sorted numerically
  const ownedJetsMap = new Map<number, string>();
  const installedJetPart = getPartById(bike.parts["main-jet"]);
  if (installedJetPart?.jetSize) {
    ownedJetsMap.set(installedJetPart.jetSize, installedJetPart.id);
  } else {
    ownedJetsMap.set(bike.tuning.mainJet, bike.parts["main-jet"]);
  }

  for (const partId of save.inventory) {
    const part = getPartById(partId);
    if (part?.slot === "main-jet" && typeof part.jetSize === "number") {
      ownedJetsMap.set(part.jetSize, part.id);
    }
  }
  const ownedJetSizes = Array.from(ownedJetsMap.keys()).sort((a, b) => a - b);
  const currentJetIndex = ownedJetSizes.indexOf(bike.tuning.mainJet);

  const handleStepJet = (delta: -1 | 1) => {
    if (ownedJetSizes.length <= 1) return;
    const baseIndex = currentJetIndex === -1 ? 0 : currentJetIndex;
    const nextIndex = Math.max(
      0,
      Math.min(ownedJetSizes.length - 1, baseIndex + delta),
    );
    const nextSize = ownedJetSizes[nextIndex];
    if (typeof nextSize === "number" && nextSize !== bike.tuning.mainJet) {
      setMainJet(nextSize);
    }
  };

  const handleStepIdleScrew = (delta: number) => {
    const next = Math.round((bike.tuning.idleScrew + delta) * 4) / 4;
    const clamped = Math.max(0.5, Math.min(3.0, next));
    setIdleScrew(clamped);
  };

  const effectivePlugColor = plugViewerColor ?? localPlugPreview;
  const recentJournal = [...save.journal].reverse();

  // Count hardware spares in the toolbox that fit the active bike (excluding main jets)
  const hardwareSparesCount = save.inventory.reduce((count, partId) => {
    const part = getPartById(partId);
    if (!part || !HARDWARE_SLOT_SET.has(part.slot)) return count;
    if (
      part.compatibleMakes !== "all" &&
      !part.compatibleMakes.includes(bike.make)
    ) {
      return count;
    }
    const isInstalled = bike.parts[part.slot] === part.id;
    if (isInstalled && !SERVICEABLE_SLOTS.includes(part.slot)) return count;
    return count + 1;
  }, 0);

  return (
    <div className="space-y-5">
      {/* Top Garage Action Bar (Bike Switcher + Roll Out CTA) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-4 border-zinc-800 bg-zinc-950 p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {save.bikes.length > 1 ? (
            <>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                Active Bike:
              </span>
              {save.bikes.map((candidate) => {
                const active = candidate.id === bike.id;
                return (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectBike(candidate.id)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-2 border-2 px-3 py-1.5 text-xs font-black uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                      active
                        ? "border-[#FFD700] bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_#FFF]"
                        : "border-zinc-700 bg-black text-zinc-300 hover:border-[#FFD700] hover:text-[#FFD700]"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 border border-black"
                      style={{ backgroundColor: candidate.colorHex }}
                      aria-hidden="true"
                    />
                    {candidate.nickname}
                  </button>
                );
              })}
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <Wrench className="h-4 w-4 text-[#FFD700]" aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                Garage Workbench &bull; Diagnose, Tune, Swap Parts
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPhase("SHOP")}
            className="inline-flex items-center gap-1.5 border-2 border-zinc-600 bg-black px-3.5 py-2 text-xs font-black uppercase tracking-wider text-zinc-100 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            Parts Counter
          </button>
          <button
            type="button"
            onClick={() => setPhase("MAP")}
            className="inline-flex items-center gap-2 border-4 border-[#FFD700] bg-[#FFD700] px-5 py-2 text-xl tracking-wider text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.9)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
          >
            <MapPin className="h-5 w-5" aria-hidden="true" />
            ROLL OUT (MAP)
          </button>
        </div>
      </div>

      {/* Main 2-Column Garage Workspace */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* LEFT COLUMN: Diagnostic Tool Tray + SVG Workbench + Readout Card */}
        <div className="space-y-5 xl:col-span-7">
          {/* 1. Diagnostic Tool Tray */}
          <section
            aria-label="Diagnostic tool tray"
            className="border-4 border-zinc-700 bg-zinc-950 p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2
                className="text-sm font-bold uppercase tracking-wider text-[#FFD700]"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Diagnostic Tool Tray
              </h2>
              <span className="text-[11px] font-bold uppercase text-zinc-400">
                Select a tool, then click a pin on the moped
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DIAGNOSTIC_TOOLS.map((tool) => {
                const isSelected = selectedTool === tool.id;
                const locked = Boolean(
                  tool.requiresStethoscope && !hasStethoscope,
                );
                return (
                  <button
                    key={tool.id}
                    type="button"
                    disabled={locked}
                    onClick={() => selectTool(tool.id)}
                    aria-pressed={isSelected}
                    title={
                      locked
                        ? "Buy the Mechanic's Stethoscope at the Parts Counter to unlock"
                        : tool.description
                    }
                    className={`flex flex-col items-start justify-between border-2 p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                      locked
                        ? "cursor-not-allowed border-zinc-800 bg-zinc-900/50 text-zinc-500"
                        : isSelected
                          ? "border-[#FFD700] bg-[#FFD700] text-black shadow-[3px_3px_0px_0px_#FFF]"
                          : "border-zinc-700 bg-black text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="text-xs font-black uppercase leading-tight">
                        {tool.shortLabel}
                      </span>
                      {locked && (
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                    </div>
                    <span
                      className={`mt-1 line-clamp-1 text-[10px] font-semibold ${
                        isSelected ? "text-black/80" : "text-zinc-400"
                      }`}
                    >
                      {locked ? "Needs Stethoscope" : tool.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Tool Helper Strip */}
            {activeToolSpec && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-2 border-zinc-800 bg-black px-3 py-2 text-xs">
                <p className="text-zinc-200">
                  <strong className="text-[#FFD700]">
                    {activeToolSpec.name}:
                  </strong>{" "}
                  {activeToolSpec.description}
                </p>
                <span className="text-[11px] font-bold uppercase text-cyan-300">
                  Targets:{" "}
                  {activeToolSpec.validHotspots
                    .map((h) => HOTSPOT_LABELS[h])
                    .join(", ")}
                </span>
              </div>
            )}
          </section>

          {/* 2. Interactive SVG Moped Workbench */}
          <MopedWorkbench
            bike={bike}
            selectedTool={selectedTool}
            garageFuelDrip={garageFuelDrip}
            bikeNeedsAttention={bikeNeedsAttention}
            lastHotspot={lastToolReading?.hotspot ?? null}
            onHotspotClick={(hotspot) => {
              runToolOnHotspot(hotspot);
            }}
          />

          {/* 3. Live Diagnostic Readout Card */}
          <section
            aria-label="Live diagnostic readout"
            aria-live="polite"
            className="border-4 border-zinc-700 bg-zinc-950 p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2
                className="text-sm font-bold uppercase tracking-wider text-[#FFD700]"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Diagnostic Readout
              </h2>
              {lastToolReading?.plugColor && (
                <button
                  type="button"
                  onClick={() =>
                    setLocalPlugPreview(lastToolReading.plugColor ?? null)
                  }
                  className="inline-flex items-center gap-1.5 border-2 border-[#FFD700] bg-[#FFD700]/15 px-2.5 py-1 text-[11px] font-black uppercase text-[#FFD700] transition-colors hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  Open Plug Viewer
                </button>
              )}
            </div>

            {lastToolReading ? (
              <div
                className={`border-2 p-4 ${severityStyles(lastToolReading.severity)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="border border-current/40 bg-black/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                    {getToolById(lastToolReading.tool)?.name ??
                      lastToolReading.tool}{" "}
                    &rarr; {HOTSPOT_LABELS[lastToolReading.hotspot]}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-widest">
                    {lastToolReading.severity === "danger"
                      ? "CRITICAL FINDING"
                      : lastToolReading.severity === "clue"
                        ? "DIAGNOSTIC CLUE"
                        : "CHECKS OUT OK"}
                  </span>
                </div>

                <h3 className="mt-2 text-lg font-black text-white">
                  {lastToolReading.headline}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-100">
                  {lastToolReading.detail}
                </p>

                {/* Visual Instrument Readout Widgets */}
                <div className="mt-3 flex flex-wrap gap-3">
                  {/* Spark Tester Badge */}
                  {lastToolReading.sparkQuality && (
                    <div className="flex items-center gap-2 border-2 border-zinc-700 bg-black px-3 py-2">
                      <Zap
                        className={`h-4 w-4 ${
                          lastToolReading.sparkQuality === "fat-blue"
                            ? "text-cyan-400"
                            : lastToolReading.sparkQuality === "weak-orange"
                              ? "text-orange-400"
                              : "text-red-500"
                        }`}
                        aria-hidden="true"
                      />
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-zinc-400">
                          Spark Tester
                        </span>
                        <span
                          className={`text-xs font-black uppercase ${
                            lastToolReading.sparkQuality === "fat-blue"
                              ? "text-cyan-300"
                              : lastToolReading.sparkQuality === "weak-orange"
                                ? "text-orange-300"
                                : "text-red-400"
                          }`}
                        >
                          {lastToolReading.sparkQuality === "fat-blue"
                            ? "Fat Blue Arc"
                            : lastToolReading.sparkQuality === "weak-orange"
                              ? "Weak Orange Flicker"
                              : "No Spark"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Compression PSI Gauge Bar */}
                  {typeof lastToolReading.compressionPsi === "number" && (
                    <div className="min-w-[200px] flex-1 border-2 border-zinc-700 bg-black px-3 py-2">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase">
                        <span className="inline-flex items-center gap-1 text-zinc-300">
                          <Gauge className="h-3.5 w-3.5 text-[#FFD700]" aria-hidden="true" />
                          Compression Gauge
                        </span>
                        <span
                          className={`tabular-nums ${
                            lastToolReading.compressionPsi >= 95
                              ? "text-emerald-400"
                              : lastToolReading.compressionPsi >= 75
                                ? "text-amber-300"
                                : "text-red-400"
                          }`}
                          style={{
                            fontFamily:
                              "var(--font-orbitron), Orbitron, monospace",
                          }}
                        >
                          {Math.round(lastToolReading.compressionPsi)} PSI
                        </span>
                      </div>
                      <div className="mt-1.5 h-3 w-full overflow-hidden border border-zinc-700 bg-zinc-900">
                        <div
                          className={`h-full transition-all ${
                            lastToolReading.compressionPsi >= 95
                              ? "bg-emerald-400"
                              : lastToolReading.compressionPsi >= 75
                                ? "bg-amber-400"
                                : "bg-red-500"
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                4,
                                (lastToolReading.compressionPsi / 150) * 100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[9px] font-bold uppercase text-zinc-500">
                        <span>0 PSI</span>
                        <span>Healthy: 100+ PSI</span>
                        <span>150 PSI</span>
                      </div>
                    </div>
                  )}

                  {/* Carb Spray RPM Jump Indicator */}
                  {typeof lastToolReading.rpmDelta === "number" && (
                    <div className="flex items-center gap-2 border-2 border-zinc-700 bg-black px-3 py-2">
                      <Flame
                        className={`h-4 w-4 ${
                          Math.abs(lastToolReading.rpmDelta) >= 150
                            ? "text-red-400"
                            : "text-emerald-400"
                        }`}
                        aria-hidden="true"
                      />
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-zinc-400">
                          Carb Spray Idle Delta
                        </span>
                        <span
                          className={`text-xs font-black uppercase tabular-nums ${
                            Math.abs(lastToolReading.rpmDelta) >= 150
                              ? "text-red-300"
                              : "text-emerald-300"
                          }`}
                          style={{
                            fontFamily:
                              "var(--font-orbitron), Orbitron, monospace",
                          }}
                        >
                          {lastToolReading.rpmDelta > 0 ? "+" : ""}
                          {Math.round(lastToolReading.rpmDelta)} RPM{" "}
                          {Math.abs(lastToolReading.rpmDelta) >= 150
                            ? "(AIR LEAK!)"
                            : "(SEALED)"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Fuel Drip Rate Badge */}
                  {lastToolReading.dripRate && (
                    <div className="flex items-center gap-2 border-2 border-zinc-700 bg-black px-3 py-2">
                      <Droplets
                        className={`h-4 w-4 ${
                          lastToolReading.dripRate === "steady"
                            ? "text-emerald-400"
                            : lastToolReading.dripRate === "trickle"
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                        aria-hidden="true"
                      />
                      <div>
                        <span className="block text-[10px] font-bold uppercase text-zinc-400">
                          Fuel Flow Test
                        </span>
                        <span
                          className={`text-xs font-black uppercase ${
                            lastToolReading.dripRate === "steady"
                              ? "text-emerald-300"
                              : lastToolReading.dripRate === "trickle"
                                ? "text-amber-300"
                                : "text-red-400"
                          }`}
                        >
                          {lastToolReading.dripRate === "steady"
                            ? "Steady Stream"
                            : lastToolReading.dripRate === "trickle"
                              ? "Weak Trickle"
                              : "No Flow (Clogged)"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-zinc-700 bg-black p-4 text-sm text-zinc-400">
                No diagnostic tests run yet. Pick a tool above — like{" "}
                <strong className="text-[#FFD700]">Plug Chop</strong>,{" "}
                <strong className="text-[#FFD700]">Spark Tester</strong>, or{" "}
                <strong className="text-[#FFD700]">Carb Spray</strong> — and
                click a glowing hotspot on your moped to inspect it.
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Tuning & Quick-Wrench + Toolbox Parts + Journal/Badges */}
        <div className="space-y-5 xl:col-span-5">
          {/* 1. Tuning & Quick-Wrench Panel */}
          <section
            aria-label="Carburetor tuning and quick wrench controls"
            className="border-4 border-[#FFD700] bg-zinc-950 p-4 shadow-[5px_5px_0px_0px_#FFD700]"
          >
            <h2
              className="mb-3 text-base font-bold uppercase tracking-wider text-[#FFD700]"
              style={{
                fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
              }}
            >
              Carb Tuning &amp; Quick Wrench
            </h2>

            {/* Main Jet Selector */}
            <div className="border-2 border-zinc-800 bg-black p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="block text-xs font-black uppercase tracking-wider text-zinc-300">
                    Main Jet Size
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Range #{jetRange.min}–#{jetRange.max} &bull; Smaller = Leaner,
                    Larger = Richer
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleStepJet(-1)}
                    disabled={currentJetIndex <= 0}
                    aria-label="Step to smaller owned main jet"
                    className="border-2 border-zinc-600 bg-zinc-900 p-1.5 text-white hover:border-[#FFD700] hover:text-[#FFD700] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <span
                    className="min-w-[3.5rem] border-2 border-[#FFD700] bg-[#FFD700]/15 px-2.5 py-1 text-center text-sm font-bold text-[#FFD700] tabular-nums"
                    style={{
                      fontFamily: "var(--font-orbitron), Orbitron, monospace",
                    }}
                  >
                    #{bike.tuning.mainJet}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStepJet(1)}
                    disabled={
                      currentJetIndex === -1 ||
                      currentJetIndex >= ownedJetSizes.length - 1
                    }
                    aria-label="Step to larger owned main jet"
                    className="border-2 border-zinc-600 bg-zinc-900 p-1.5 text-white hover:border-[#FFD700] hover:text-[#FFD700] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {ownedJetSizes.map((size) => {
                  const active = size === bike.tuning.mainJet;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setMainJet(size)}
                      aria-pressed={active}
                      className={`border-2 px-2.5 py-1 text-xs font-black tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                        active
                          ? "border-[#FFD700] bg-[#FFD700] text-black"
                          : "border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-[#FFD700] hover:text-[#FFD700]"
                      }`}
                      style={{
                        fontFamily: "var(--font-orbitron), Orbitron, monospace",
                      }}
                    >
                      #{size}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPhase("SHOP")}
                  className="ml-auto border-2 border-dashed border-cyan-500/70 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-black uppercase text-cyan-300 hover:border-cyan-300 hover:bg-cyan-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  + Buy Jets
                </button>
              </div>
            </div>

            {/* Needle Clip & Idle Air Screw */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Needle Clip */}
              <div className="border-2 border-zinc-800 bg-black p-3">
                <div className="flex items-center justify-between text-xs font-black uppercase">
                  <span className="text-zinc-300">Needle Clip</span>
                  <span className="text-[#FFD700]">
                    Pos {bike.tuning.needleClip}/5
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {NEEDLE_CLIPS.map((clip) => {
                    const active = bike.tuning.needleClip === clip;
                    return (
                      <button
                        key={clip}
                        type="button"
                        onClick={() => setNeedleClip(clip)}
                        aria-pressed={active}
                        aria-label={`Set needle clip position ${clip}`}
                        className={`border-2 py-1.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                          active
                            ? "border-[#FFD700] bg-[#FFD700] text-black"
                            : "border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-[#FFD700]"
                        }`}
                      >
                        {clip}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-1 flex justify-between text-[10px] font-bold uppercase text-zinc-400">
                  <span>1 Leanest</span>
                  <span>5 Richest</span>
                </div>
              </div>

              {/* Idle Air Screw */}
              <div className="border-2 border-zinc-800 bg-black p-3">
                <div className="flex items-center justify-between text-xs font-black uppercase">
                  <span className="text-zinc-300">Idle Air Screw</span>
                  <span
                    className="text-[#FFD700] tabular-nums"
                    style={{
                      fontFamily: "var(--font-orbitron), Orbitron, monospace",
                    }}
                  >
                    {bike.tuning.idleScrew.toFixed(2)}t
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStepIdleScrew(-0.25)}
                    disabled={bike.tuning.idleScrew <= 0.5}
                    aria-label="Turn idle air screw in 0.25 turns"
                    className="border-2 border-zinc-700 bg-zinc-950 p-1 text-zinc-200 hover:border-[#FFD700] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  >
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <input
                    type="range"
                    min={0.5}
                    max={3.0}
                    step={0.25}
                    value={bike.tuning.idleScrew}
                    onChange={(e) =>
                      setIdleScrew(Number.parseFloat(e.target.value))
                    }
                    aria-label="Idle air screw turns out"
                    className="h-2 w-full cursor-pointer accent-[#FFD700]"
                  />
                  <button
                    type="button"
                    onClick={() => handleStepIdleScrew(0.25)}
                    disabled={bike.tuning.idleScrew >= 3.0}
                    aria-label="Turn idle air screw out 0.25 turns"
                    className="border-2 border-zinc-700 bg-zinc-950 p-1 text-zinc-200 hover:border-[#FFD700] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <div className="mt-1 flex justify-between text-[10px] font-bold uppercase text-zinc-400">
                  <span>0.5t Richer</span>
                  <span>3.0t Leaner</span>
                </div>
              </div>
            </div>

            {/* Quick Maintenance Buttons */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={toggleKillSwitch}
                aria-pressed={bike.tuning.killSwitchOn}
                title={
                  bike.tuning.killSwitchOn
                    ? "Ignition killed — click to flip kill switch to RUN"
                    : "Ignition live — click to flip kill switch to OFF"
                }
                className={`flex flex-wrap items-center justify-between gap-1 border-2 px-3 py-2 text-left text-xs font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                  bike.tuning.killSwitchOn
                    ? "border-red-500 bg-red-950 text-red-100 hover:bg-red-900"
                    : "border-emerald-500/70 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Power className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    Kill Switch:{" "}
                    {bike.tuning.killSwitchOn ? "OFF (KILLED)" : "RUN"}
                  </span>
                </span>
                <span className="border border-current/40 bg-black/40 px-1.5 py-0.5 text-[10px]">
                  {bike.tuning.killSwitchOn ? "Flip to RUN" : "Flip to OFF"}
                </span>
              </button>

              <button
                type="button"
                onClick={addPremixOil}
                className={`flex items-center justify-between border-2 px-3 py-2 text-left text-xs font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                  bike.tuning.hasPremixOil
                    ? "border-emerald-500/70 bg-emerald-950/40 text-emerald-200 hover:border-emerald-400"
                    : "border-red-500 bg-red-950 text-red-100 hover:bg-red-900"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                  2T Premix Oil
                </span>
                <span>{bike.tuning.hasPremixOil ? "50:1 OK" : "ADD OIL!"}</span>
              </button>

              <button
                type="button"
                onClick={cleanAirFilter}
                className="flex items-center justify-center gap-1.5 border-2 border-zinc-700 bg-black px-3 py-2 text-xs font-black uppercase text-zinc-100 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#FFD700]" aria-hidden="true" />
                Clean Air Filter
              </button>

              <button
                type="button"
                onClick={cleanCarburetor}
                className="flex items-center justify-center gap-1.5 border-2 border-zinc-700 bg-black px-3 py-2 text-xs font-black uppercase text-zinc-100 transition-colors hover:border-[#FFD700] hover:text-[#FFD700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
              >
                <Wrench className="h-3.5 w-3.5 text-[#FFD700]" aria-hidden="true" />
                Clean Carburetor
              </button>
            </div>
          </section>

          {/* 2. Toolbox / Installed Parts Swapper */}
          <section
            aria-label="Installed parts and toolbox"
            className="border-4 border-zinc-700 bg-zinc-950 p-4"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2
                className="text-sm font-bold uppercase tracking-wider text-[#FFD700]"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                Installed Parts &amp; Toolbox
              </h2>
              <span className="text-[11px] font-bold uppercase text-zinc-400">
                {hardwareSparesCount}{" "}
                {hardwareSparesCount === 1 ? "Spare" : "Spares"} for Bike
              </span>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {HARDWARE_SLOTS.map(({ slot, label }) => {
                const installedId = bike.parts[slot];
                const installedPart = installedId
                  ? getPartById(installedId)
                  : undefined;

                // Owned compatible parts for this slot (including fresh replacements for serviceable slots)
                const isServiceable = SERVICEABLE_SLOTS.includes(slot);
                const swapCounts = new Map<string, number>();
                const ownedSwaps: PartSpec[] = [];
                for (const id of save.inventory) {
                  const p = getPartById(id);
                  if (p?.slot !== slot) continue;
                  if (p.id === installedId && !isServiceable) continue;
                  if (
                    p.compatibleMakes !== "all" &&
                    !p.compatibleMakes.includes(bike.make)
                  ) {
                    continue;
                  }
                  const prev = swapCounts.get(p.id) ?? 0;
                  swapCounts.set(p.id, prev + 1);
                  if (prev === 0) ownedSwaps.push(p);
                }

                // Skip belt slot if not installed and no compatible belt exists in catalog for this make
                if (
                  slot === "belt" &&
                  !installedId &&
                  ownedSwaps.length === 0 &&
                  !PARTS_CATALOG.some(
                    (p) =>
                      p.slot === "belt" &&
                      (p.compatibleMakes === "all" ||
                        p.compatibleMakes.includes(bike.make)),
                  )
                ) {
                  return null;
                }

                return (
                  <div
                    key={slot}
                    className="border-2 border-zinc-800 bg-black px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        {label}
                      </span>
                      {installedPart?.visualTag && (
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-black uppercase ${
                            installedPart.visualTag === "race"
                              ? "bg-[#FFD700] text-black"
                              : installedPart.visualTag === "performance"
                                ? "bg-cyan-400 text-black"
                                : "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {installedPart.visualTag}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs font-bold text-white">
                      {installedPart?.name ?? installedId ?? "None installed"}
                    </p>

                    {ownedSwaps.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-800 pt-2">
                        {ownedSwaps.map((swap) => {
                          const qty = swapCounts.get(swap.id) ?? 1;
                          return (
                            <button
                              key={swap.id}
                              type="button"
                              onClick={() => installPart(swap.id)}
                              className="border border-[#FFD700]/70 bg-[#FFD700]/10 px-2 py-0.5 text-[10px] font-black uppercase text-[#FFD700] transition-colors hover:bg-[#FFD700] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]"
                            >
                              {swap.id === installedId ? "Install Fresh" : "Swap"}:{" "}
                              {swap.name}
                              {qty > 1 ? ` (×${qty})` : ""}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. Mechanic's Journal & Earned Badges */}
          <section
            aria-label="Mechanic's journal and badges"
            className="border-4 border-zinc-700 bg-zinc-950 p-4"
          >
            <div className="mb-3 flex items-center gap-2 border-b-2 border-zinc-800 pb-2">
              <button
                type="button"
                onClick={() => setRightBottomTab("journal")}
                aria-pressed={rightBottomTab === "journal"}
                className={`inline-flex items-center gap-1.5 border-2 px-3 py-1 text-xs font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                  rightBottomTab === "journal"
                    ? "border-[#FFD700] bg-[#FFD700] text-black"
                    : "border-zinc-700 bg-black text-zinc-300 hover:border-[#FFD700]"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                Journal ({save.journal.length})
              </button>
              <button
                type="button"
                onClick={() => setRightBottomTab("badges")}
                aria-pressed={rightBottomTab === "badges"}
                className={`inline-flex items-center gap-1.5 border-2 px-3 py-1 text-xs font-black uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] ${
                  rightBottomTab === "badges"
                    ? "border-[#FFD700] bg-[#FFD700] text-black"
                    : "border-zinc-700 bg-black text-zinc-300 hover:border-[#FFD700]"
                }`}
              >
                <Award className="h-3.5 w-3.5" aria-hidden="true" />
                Badges ({save.badges.length})
              </button>
            </div>

            {rightBottomTab === "journal" ? (
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {recentJournal.length === 0 ? (
                  <p className="text-xs text-zinc-400">
                    Your mechanic&apos;s notes will appear here as you ride and
                    diagnose symptoms.
                  </p>
                ) : (
                  recentJournal.map((entry) => (
                    <article
                      key={entry.id}
                      className="border-l-4 border-zinc-700 bg-black px-3 py-2"
                      style={{
                        borderLeftColor:
                          entry.category === "fix"
                            ? "#34D399"
                            : entry.category === "tool"
                              ? "#22D3EE"
                              : entry.category === "badge"
                                ? "#FFD700"
                                : "#F97316",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-xs font-black uppercase text-white">
                          {entry.title}
                        </h3>
                        <span className="text-[10px] font-bold uppercase text-zinc-500">
                          {entry.category}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-300">
                        {entry.body}
                      </p>
                    </article>
                  ))
                )}
              </div>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {save.badges.length === 0 ? (
                  <div className="border-2 border-dashed border-zinc-800 bg-black p-4 text-center text-xs text-zinc-400">
                    <AlertTriangle
                      className="mx-auto mb-1.5 h-5 w-5 text-zinc-500"
                      aria-hidden="true"
                    />
                    No wrench badges yet. Diagnose a fault, survive a seize with
                    the clutch, or pedal home to earn East Bay street cred!
                  </div>
                ) : (
                  save.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className="flex items-start gap-2.5 border-2 border-[#FFD700]/60 bg-[#FFD700]/10 p-2.5"
                    >
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#FFD700]"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-black uppercase text-[#FFD700]">
                          {badge.title}
                        </p>
                        <p className="text-xs text-zinc-200">
                          {badge.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Close-Up Spark Plug Chop Viewer Modal */}
      <PlugViewer
        color={effectivePlugColor}
        onClose={() => {
          closePlugViewer();
          setLocalPlugPreview(null);
        }}
      />
    </div>
  );
}
