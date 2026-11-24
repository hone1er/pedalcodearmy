"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coffee,
  Lock,
  MapPin,
  Moon,
  Mountain,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Thermometer,
  TrafficCone,
  Wrench,
  Zap,
} from "lucide-react";
import type { RouteMedal, RouteSpec } from "@/lib/simulator/contract";
import { ROUTES } from "@/lib/simulator/ride/routes";
import { getActiveBike, useSimStore } from "@/lib/simulator/store/sim-store";

export const ROUTE_MEDAL_ORDER: RouteMedal[] = [
  "finished",
  "speed",
  "cool-head",
  "hot-coffee",
];

export function getRouteMedalMeta(
  medal: RouteMedal,
  hasCoffeeCup?: boolean,
): {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
} {
  switch (medal) {
    case "finished":
      return {
        label: "Cleared",
        icon: CheckCircle2,
        className: "border-emerald-400 bg-emerald-950/80 text-emerald-200",
      };
    case "speed":
      return {
        label: "Speed",
        icon: Zap,
        className: "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]",
      };
    case "cool-head":
      return {
        label: "Cool Head",
        icon: Thermometer,
        className: "border-cyan-400 bg-cyan-950/80 text-cyan-200",
      };
    case "hot-coffee":
      return {
        label: hasCoffeeCup ? "Hot Coffee" : "Clean Run",
        icon: hasCoffeeCup ? Coffee : Sparkles,
        className: "border-orange-400 bg-orange-950/80 text-orange-200",
      };
  }
}

const DIFFICULTY_STYLES: Record<
  RouteSpec["difficulty"],
  { label: string; className: string }
> = {
  chill: {
    label: "CHILL",
    className: "border-emerald-400 bg-emerald-950/70 text-emerald-200",
  },
  tricky: {
    label: "TRICKY",
    className: "border-[#FFD700] bg-[#FFD700]/15 text-[#FFD700]",
  },
  spicy: {
    label: "SPICY",
    className: "border-orange-500 bg-orange-950/70 text-orange-200",
  },
  "send-it": {
    label: "SEND IT",
    className: "border-red-500 bg-red-950/80 text-red-200",
  },
};

const TIME_META: Record<
  RouteSpec["timeOfDay"],
  { label: string; icon: typeof Sun }
> = {
  morning: { label: "Morning", icon: Sunrise },
  golden: { label: "Golden Hour", icon: Sun },
  sunset: { label: "Sunset", icon: Sunset },
  night: { label: "Midnight", icon: Moon },
};

interface ElevationPoint {
  x: number;
  y: number;
  elev: number;
  hasStoplight?: boolean;
  landmark?: string;
}

function buildElevationGraph(route: RouteSpec): {
  polyline: string;
  areaPath: string;
  stoplightPoints: ElevationPoint[];
  maxGradePct: number;
} {
  const width = 280;
  const height = 74;
  const padX = 8;
  const padTop = 12;
  const padBottom = 10;

  let currentElev = 0;
  const rawPoints: Array<{
    dist: number;
    elev: number;
    hasStoplight?: boolean;
    landmark?: string;
  }> = [{ dist: 0, elev: 0 }];

  let maxGradePct = 0;

  for (const seg of route.segments) {
    const segLen = Math.max(1, seg.endM - seg.startM);
    maxGradePct = Math.max(maxGradePct, seg.gradePct);
    const deltaElev = (segLen * seg.gradePct) / 100;
    currentElev += deltaElev;
    rawPoints.push({
      dist: seg.endM,
      elev: currentElev,
      hasStoplight: seg.hasStoplight,
      landmark: seg.landmark,
    });
  }

  const totalDist = Math.max(1, route.lengthM);
  const minElev = Math.min(...rawPoints.map((p) => p.elev));
  const maxElev = Math.max(...rawPoints.map((p) => p.elev));
  const elevSpan = Math.max(12, maxElev - minElev);

  const mapped: ElevationPoint[] = rawPoints.map((p) => {
    const x = padX + (Math.min(p.dist, totalDist) / totalDist) * (width - padX * 2);
    const normElev = (p.elev - minElev) / elevSpan;
    const y = height - padBottom - normElev * (height - padTop - padBottom);
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      elev: p.elev,
      hasStoplight: p.hasStoplight,
      landmark: p.landmark,
    };
  });

  const polyline = mapped.map((p) => `${p.x},${p.y}`).join(" ");
  const first = mapped[0] ?? { x: padX, y: height - padBottom };
  const last = mapped[mapped.length - 1] ?? {
    x: width - padX,
    y: height - padBottom,
  };
  const areaPath = `M ${first.x} ${height - padBottom} L ${mapped
    .map((p) => `${p.x} ${p.y}`)
    .join(" L ")} L ${last.x} ${height - padBottom} Z`;

  const stoplightPoints = mapped.filter((p) => p.hasStoplight);

  return { polyline, areaPath, stoplightPoints, maxGradePct };
}

export function RouteMap() {
  const { save, bikeVerdict, startRide, setPhase } = useSimStore();
  const bike = getActiveBike(save);

  const readinessWarnings: Array<{ id: string; text: string }> = [];
  if (bike.tuning.killSwitchOn) {
    readinessWarnings.push({
      id: "kill-switch",
      text: "Heads up: Your kill switch is flipped to OFF (KILLED) in the garage — flip it to RUN before rolling out!",
    });
  }
  if (!bike.tuning.hasPremixOil) {
    readinessWarnings.push({
      id: "premix-oil",
      text: "Danger: You haven't added 2-stroke premix oil to the tank yet — riding on straight gas will seize the piston!",
    });
  }
  if (readinessWarnings.length === 0) {
    if (bikeVerdict === "acting-up") {
      readinessWarnings.push({
        id: "acting-up",
        text: "Last ride showed symptoms — listen closely on the road.",
      });
    } else if (bikeVerdict === "untested") {
      readinessWarnings.push({
        id: "untested",
        text: "Freshly wrenched — roll out to see how it runs.",
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* East Bay Route Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-4 border-[#FFD700] bg-zinc-950 p-5 shadow-[6px_6px_0px_0px_#FFD700]">
        <div>
          <span className="inline-flex items-center gap-1.5 border-2 border-[#FFD700] bg-[#FFD700] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest text-black">
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            510 Street Routes
          </span>
          <h2
            className="mt-2 text-4xl tracking-wider text-[#FFD700] sm:text-5xl"
            style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
          >
            EAST BAY ROUTE MAP
          </h2>
          <p className="mt-1 text-sm text-zinc-300">
            Pick a run to shakedown{" "}
            <strong className="text-white">{bike.nickname}</strong>. Listen to
            the exhaust note, watch smoke and temperature, and finish routes to
            stack cash &amp; rep.
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

      {/* Pre-Ride Readiness Strip */}
      {readinessWarnings.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-2 border-amber-400 bg-amber-950/40 px-4 py-3 text-xs text-amber-100"
        >
          <ul className="space-y-1.5">
            {readinessWarnings.map((warning) => (
              <li key={warning.id} className="flex items-start gap-2.5">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0 text-amber-300"
                  aria-hidden="true"
                />
                <span className="font-bold">{warning.text}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPhase("GARAGE")}
            className="border-2 border-amber-300 bg-black px-3 py-1 text-[11px] font-black uppercase text-amber-200 hover:bg-amber-300 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Check in Garage
          </button>
        </div>
      )}

      {/* 4 East Bay Routes Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {ROUTES.map((route) => {
          const cleared = save.completedRoutes.includes(route.id);
          const locked = save.rep < route.repRequired;
          const diff = DIFFICULTY_STYLES[route.difficulty];
          const timeInfo = TIME_META[route.timeOfDay];
          const TimeIcon = timeInfo.icon;
          const graph = buildElevationGraph(route);
          const hasStoplights = route.segments.some((s) => s.hasStoplight);
          const miles = (route.lengthM / 1609.34).toFixed(1);
          const landmarks = route.segments
            .map((s) => s.landmark)
            .filter((l): l is string => Boolean(l));
          const earnedMedals = save.routeMedals?.[route.id] ?? [];

          return (
            <article
              key={route.id}
              className={`flex flex-col justify-between border-4 bg-zinc-950 p-5 ${
                locked
                  ? "border-zinc-800 opacity-80"
                  : cleared
                    ? "border-emerald-500/80 shadow-[6px_6px_0px_0px_rgba(16,185,129,0.5)]"
                    : "border-[#FFD700] shadow-[6px_6px_0px_0px_#FFD700]"
              }`}
            >
              <div>
                {/* Top badges */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`border-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${diff.className}`}
                    >
                      {diff.label}
                    </span>
                    <span className="inline-flex items-center gap-1 border border-zinc-700 bg-black px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-300">
                      <TimeIcon className="h-3 w-3 text-[#FFD700]" aria-hidden="true" />
                      {timeInfo.label}
                    </span>
                  </div>
                  {cleared && (
                    <span className="inline-flex items-center gap-1 border-2 border-emerald-400 bg-emerald-950 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-200">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      Cleared
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <h3
                  className="mt-3 text-3xl tracking-wider text-[#FFD700]"
                  style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
                >
                  {route.name}
                </h3>
                <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  {route.subtitle}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                  {route.description}
                </p>

                {/* Earned Route Medals */}
                {earnedMedals.length > 0 && (
                  <div
                    aria-label="Earned route medals"
                    className="mt-3 flex flex-wrap gap-1.5"
                  >
                    {ROUTE_MEDAL_ORDER.filter((m) =>
                      earnedMedals.includes(m),
                    ).map((medal) => {
                      const meta = getRouteMedalMeta(medal, route.hasCoffeeCup);
                      const MedalIcon = meta.icon;
                      return (
                        <span
                          key={medal}
                          className={`inline-flex items-center gap-1 border-2 px-2 py-0.5 text-[10px] font-black uppercase ${meta.className}`}
                        >
                          <MedalIcon className="h-3 w-3" aria-hidden="true" />
                          {meta.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Mini SVG Elevation Profile Graph */}
                <div className="mt-4 border-2 border-zinc-800 bg-black p-3">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    <span>Elevation Profile</span>
                    <span className="text-[#FFD700]">
                      Max Grade: {graph.maxGradePct > 0 ? `+${graph.maxGradePct}%` : "Flat"}
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 280 74"
                    role="img"
                    aria-label={`${route.name} elevation profile with maximum grade ${graph.maxGradePct} percent`}
                    className="h-20 w-full"
                  >
                    <defs>
                      <linearGradient
                        id={`elev-${route.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.45" />
                        <stop offset="100%" stopColor="#FFD700" stopOpacity="0.03" />
                      </linearGradient>
                    </defs>
                    {/* Baseline */}
                    <line
                      x1="8"
                      y1="64"
                      x2="272"
                      y2="64"
                      stroke="#27272A"
                      strokeWidth="1.5"
                    />
                    <path d={graph.areaPath} fill={`url(#elev-${route.id})`} />
                    <polyline
                      points={graph.polyline}
                      fill="none"
                      stroke="#FFD700"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {/* Stoplight markers */}
                    {graph.stoplightPoints.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4.5"
                          fill="#EF4444"
                          stroke="#000000"
                          strokeWidth="1.5"
                        />
                      </g>
                    ))}
                  </svg>
                  {landmarks.length > 0 && (
                    <p
                      title={`Landmarks: ${landmarks.join(" → ")}`}
                      className="mt-1.5 text-[10px] font-bold uppercase leading-relaxed text-zinc-400"
                    >
                      Landmarks: {landmarks.join(" → ")}
                    </p>
                  )}
                </div>

                {/* Special Mission Callouts */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {route.hasCoffeeCup && (
                    <span className="inline-flex items-center gap-1 border border-amber-400/70 bg-amber-950/40 px-2 py-1 text-[10px] font-black uppercase text-amber-200">
                      <Coffee className="h-3 w-3" aria-hidden="true" />
                      Hot Coffee Cup
                    </span>
                  )}
                  {hasStoplights && (
                    <span className="inline-flex items-center gap-1 border border-red-500/70 bg-red-950/40 px-2 py-1 text-[10px] font-black uppercase text-red-200">
                      <TrafficCone className="h-3 w-3" aria-hidden="true" />
                      Stoplight Idling
                    </span>
                  )}
                  {graph.maxGradePct >= 8 && (
                    <span className="inline-flex items-center gap-1 border border-orange-500/70 bg-orange-950/40 px-2 py-1 text-[10px] font-black uppercase text-orange-200">
                      <Mountain className="h-3 w-3" aria-hidden="true" />
                      Steep Climb (+{graph.maxGradePct}%)
                    </span>
                  )}
                  {route.timeOfDay === "night" && (
                    <span className="inline-flex items-center gap-1 border border-cyan-500/70 bg-cyan-950/40 px-2 py-1 text-[10px] font-black uppercase text-cyan-200">
                      <Moon className="h-3 w-3" aria-hidden="true" />
                      Night Tunnel Blast
                    </span>
                  )}
                </div>

                {/* Distance & Payout Stats */}
                <div className="mt-4 grid grid-cols-3 gap-2 border-2 border-zinc-800 bg-black p-2.5 text-center">
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-zinc-400">
                      Distance
                    </span>
                    <span
                      className="text-xs font-bold text-white tabular-nums"
                      style={{
                        fontFamily: "var(--font-orbitron), Orbitron, monospace",
                      }}
                    >
                      {miles} MI
                    </span>
                  </div>
                  <div className="border-x border-zinc-800">
                    <span className="block text-[10px] font-bold uppercase text-zinc-400">
                      Cash Payout
                    </span>
                    <span
                      className="text-xs font-bold text-[#FFD700] tabular-nums"
                      style={{
                        fontFamily: "var(--font-orbitron), Orbitron, monospace",
                      }}
                    >
                      +${route.rewardCash}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-zinc-400">
                      Street Rep
                    </span>
                    <span
                      className="text-xs font-bold text-cyan-300 tabular-nums"
                      style={{
                        fontFamily: "var(--font-orbitron), Orbitron, monospace",
                      }}
                    >
                      +{route.rewardRep} REP
                    </span>
                  </div>
                </div>
              </div>

              {/* Kickstart & Ride CTA */}
              <div className="mt-5">
                {locked ? (
                  <div className="flex items-center justify-center gap-2 border-2 border-zinc-700 bg-zinc-900 py-3 text-xs font-black uppercase tracking-wider text-zinc-400">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                    Locked &bull; Requires {route.repRequired} Rep
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startRide(route.id)}
                    className="flex w-full items-center justify-center gap-2 border-4 border-[#FFD700] bg-[#FFD700] py-3 text-2xl tracking-wider text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.9)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
                    style={{
                      fontFamily: "var(--font-bangers), Bangers, cursive",
                    }}
                  >
                    KICKSTART &amp; RIDE
                    <ArrowRight className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
