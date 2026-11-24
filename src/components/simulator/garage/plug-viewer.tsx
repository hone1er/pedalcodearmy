"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Flame, X } from "lucide-react";
import type { PlugColor } from "@/lib/simulator/contract";

export interface PlugViewerProps {
  color: PlugColor | null;
  onClose: () => void;
}

interface PlugVisualProfile {
  title: string;
  badge: string;
  bucket: "rich" | "ideal" | "lean" | "fouled";
  toneClass: string;
  ceramicInner: string;
  ceramicMid: string;
  ceramicEdge: string;
  electrodeColor: string;
  strapTint: string;
  wetGloss: boolean;
  sootSpecks: boolean;
  blisterSpecks: boolean;
  oilBridge: boolean;
  summary: string;
  nextStep: string;
}

const PLUG_PROFILES: Record<PlugColor, PlugVisualProfile> = {
  "tan-ideal": {
    title: "Chocolate Tan (Dialed!)",
    badge: "IDEAL MIXTURE",
    bucket: "ideal",
    toneClass: "border-emerald-400 bg-emerald-950/60 text-emerald-200",
    ceramicInner: "#D99B66",
    ceramicMid: "#9C5B2C",
    ceramicEdge: "#5C3317",
    electrodeColor: "#D4D4D8",
    strapTint: "#A1A1AA",
    wetGloss: false,
    sootSpecks: false,
    blisterSpecks: false,
    oilBridge: false,
    summary:
      "Warm coffee-with-cream chocolate tan ceramic with a dry, crisp electrode tip. Air-fuel ratio and heat range are right in the sweet spot.",
    nextStep: "Leave the main jet alone and go rip East Bay streets.",
  },
  "black-wet": {
    title: "Black & Wet (Too Rich)",
    badge: "RICH / FUEL-SOAKED",
    bucket: "rich",
    toneClass: "border-amber-400 bg-amber-950/60 text-amber-200",
    ceramicInner: "#27272A",
    ceramicMid: "#111114",
    ceramicEdge: "#050507",
    electrodeColor: "#3F3F46",
    strapTint: "#18181B",
    wetGloss: true,
    sootSpecks: true,
    blisterSpecks: false,
    oilBridge: false,
    summary:
      "Shiny, fuel-soaked black ceramic and wet threads. Unburned 2-stroke mix is drenching the combustion chamber and causing 4-stroking.",
    nextStep:
      "Step down to a smaller main jet, lower the needle clip, or check for a choked air filter.",
  },
  "black-sooty": {
    title: "Dry Carbon Soot (Rich)",
    badge: "CARBON RICH",
    bucket: "rich",
    toneClass: "border-amber-400 bg-amber-950/60 text-amber-200",
    ceramicInner: "#3F3F46",
    ceramicMid: "#1F1F23",
    ceramicEdge: "#09090B",
    electrodeColor: "#52525B",
    strapTint: "#27272A",
    wetGloss: false,
    sootSpecks: true,
    blisterSpecks: false,
    oilBridge: false,
    summary:
      "Velvety, matte carbon soot caked around the porcelain cone. The mixture is burning rich or the plug is running too cold to self-clean.",
    nextStep:
      "Drop a main jet size or two, clean the air filter, and make sure the choke isn't stuck on.",
  },
  "white-lean": {
    title: "Chalky White (Too Lean!)",
    badge: "LEAN WARNING",
    bucket: "lean",
    toneClass: "border-red-500 bg-red-950/60 text-red-200",
    ceramicInner: "#FFFFFF",
    ceramicMid: "#F4F4F5",
    ceramicEdge: "#D4D4D8",
    electrodeColor: "#E2E8F0",
    strapTint: "#93C5FD",
    wetGloss: false,
    sootSpecks: false,
    blisterSpecks: false,
    oilBridge: false,
    summary:
      "Stark, bleached chalk-white ceramic with a heat-blued ground strap. Cylinder temperatures are dangerously hot — high risk of soft seize!",
    nextStep:
      "Up-jet immediately and spray carb cleaner around the intake gasket to rule out an air leak.",
  },
  "white-blistered": {
    title: "White & Blistered (Detonation!)",
    badge: "DANGER • SEIZE RISK",
    bucket: "lean",
    toneClass: "border-red-500 bg-red-950/80 text-red-100",
    ceramicInner: "#FFFFFF",
    ceramicMid: "#E5E7EB",
    ceramicEdge: "#CBD5E1",
    electrodeColor: "#F8FAFC",
    strapTint: "#60A5FA",
    wetGloss: false,
    sootSpecks: false,
    blisterSpecks: true,
    oilBridge: false,
    summary:
      "Blistered porcelain peppered with tiny metallic aluminum specks from piston crown detonation. Keep riding like this and the piston will weld itself to the bore!",
    nextStep:
      "Stop riding hard! Up-jet, check for air leaks at the intake/base gasket, and verify 2-stroke premix oil.",
  },
  "oily-fouled": {
    title: "Oily Fouled & Bridged",
    badge: "FOULED PLUG",
    bucket: "fouled",
    toneClass: "border-orange-400 bg-orange-950/60 text-orange-200",
    ceramicInner: "#292524",
    ceramicMid: "#1C1917",
    ceramicEdge: "#0C0A09",
    electrodeColor: "#44403C",
    strapTint: "#1C1917",
    wetGloss: true,
    sootSpecks: true,
    blisterSpecks: false,
    oilBridge: true,
    summary:
      "Thick, sludgy oil and carbon deposits are shorting across the insulator and spark gap so spark can't jump cleanly.",
    nextStep:
      "Swap in a fresh NGK spark plug and verify your jetting isn't drowning the new plug.",
  },
  "dry-clean": {
    title: "Dry & Clean (Un-Run or No Premix)",
    badge: "UN-RUN / CHECK PREMIX",
    bucket: "fouled",
    toneClass: "border-cyan-400 bg-cyan-950/60 text-cyan-200",
    ceramicInner: "#FAFAF9",
    ceramicMid: "#E7E5E4",
    ceramicEdge: "#D6D3D1",
    electrodeColor: "#E4E4E7",
    strapTint: "#D4D4D8",
    wetGloss: false,
    sootSpecks: false,
    blisterSpecks: false,
    oilBridge: false,
    summary:
      "Clean, dry porcelain with barely any combustion color. Either this is a brand-new, un-run plug — or there's no 2-stroke premix oil in the gas tank leaving any oil residue.",
    nextStep:
      "Check the gas tank for 50:1 2-stroke premix oil first, then take a short ride and do a plug chop before reading jetting.",
  },
};

const REFERENCE_STRIP: Array<{
  bucket: PlugVisualProfile["bucket"];
  label: string;
  sub: string;
  swatch: string;
}> = [
  {
    bucket: "rich",
    label: "Too Rich",
    sub: "Black / Wet / Sooty",
    swatch: "radial-gradient(circle at 45% 40%, #3F3F46 0%, #111114 70%, #050507 100%)",
  },
  {
    bucket: "ideal",
    label: "Chocolate Tan",
    sub: "Ideal Dialed Tune",
    swatch: "radial-gradient(circle at 45% 40%, #E0A46C 0%, #9C5B2C 68%, #5C3317 100%)",
  },
  {
    bucket: "lean",
    label: "Too Lean",
    sub: "White / Blistered",
    swatch: "radial-gradient(circle at 45% 40%, #FFFFFF 0%, #E5E7EB 68%, #93C5FD 100%)",
  },
  {
    bucket: "fouled",
    label: "Fouled / Un-Run",
    sub: "Oily Bridge or Clean Dry",
    swatch: "radial-gradient(circle at 45% 40%, #57534E 0%, #1C1917 65%, #0C0A09 100%)",
  },
];

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PlugViewer({ color, onClose }: PlugViewerProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  const isOpen = color !== null;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "Tab") {
        const container = dialogRef.current;
        if (!container) return;
        const focusables = Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        );
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey) {
          if (!container.contains(active) || active === first) {
            event.preventDefault();
            last.focus();
          }
        } else if (!container.contains(active) || active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!color) return null;

  const profile = PLUG_PROFILES[color];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="plug-viewer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto border-4 border-[#FFD700] bg-zinc-950 text-white shadow-[10px_10px_0px_0px_#FFD700]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b-4 border-[#FFD700] bg-[#FFD700] px-5 py-3 text-black">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5" aria-hidden="true" />
            <h2
              id="plug-viewer-title"
              className="text-2xl tracking-wider sm:text-3xl"
              style={{ fontFamily: "var(--font-bangers), Bangers, cursive" }}
            >
              SPARK PLUG CHOP VIEWER
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close spark plug viewer"
            className="border-2 border-black bg-black p-1.5 text-[#FFD700] transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-12">
          {/* Close-Up Spark Plug SVG */}
          <div className="flex flex-col items-center justify-center border-2 border-zinc-800 bg-black p-4 md:col-span-6">
            <svg
              viewBox="0 0 320 300"
              role="img"
              aria-label={`Close-up of spark plug ceramic insulator showing ${profile.title}`}
              className="h-60 w-full max-w-[280px]"
            >
              <defs>
                <radialGradient id="plug-ceramic-grad" cx="44%" cy="42%" r="60%">
                  <stop offset="0%" stopColor={profile.ceramicInner} />
                  <stop offset="62%" stopColor={profile.ceramicMid} />
                  <stop offset="100%" stopColor={profile.ceramicEdge} />
                </radialGradient>
                <linearGradient id="plug-metal-shell" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3F3F46" />
                  <stop offset="30%" stopColor="#A1A1AA" />
                  <stop offset="55%" stopColor="#52525B" />
                  <stop offset="85%" stopColor="#D4D4D8" />
                  <stop offset="100%" stopColor="#27272A" />
                </linearGradient>
                <radialGradient id="plug-cavity" cx="50%" cy="50%" r="50%">
                  <stop offset="60%" stopColor="#09090B" />
                  <stop offset="100%" stopColor="#27272A" />
                </radialGradient>
              </defs>

              {/* Magnifier reticle backdrop */}
              <rect width="320" height="300" fill="#050507" />
              <circle cx="160" cy="148" r="126" fill="none" stroke="#27272A" strokeWidth="2" strokeDasharray="6 6" />
              <line x1="20" y1="148" x2="54" y2="148" stroke="#FFD700" strokeWidth="2" opacity="0.5" />
              <line x1="266" y1="148" x2="300" y2="148" stroke="#FFD700" strokeWidth="2" opacity="0.5" />

              {/* Outer threaded metal body & washer ring (top-down / angled macro view) */}
              <circle cx="160" cy="148" r="106" fill="url(#plug-metal-shell)" stroke="#18181B" strokeWidth="4" />
              {/* Thread rings */}
              <circle cx="160" cy="148" r="96" fill="none" stroke="#27272A" strokeWidth="3" strokeDasharray="10 4" />
              <circle cx="160" cy="148" r="88" fill="#3F3F46" stroke="#18181B" strokeWidth="3" />
              {/* Deep combustion ring cavity */}
              <circle cx="160" cy="148" r="76" fill="url(#plug-cavity)" stroke="#52525B" strokeWidth="3" />

              {/* Ceramic Insulator Nose Cone */}
              <circle
                cx="160"
                cy="148"
                r="54"
                fill="url(#plug-ceramic-grad)"
                stroke="#18181B"
                strokeWidth="3"
              />
              {/* Subtle 3D insulator taper ring */}
              <circle
                cx="160"
                cy="148"
                r="34"
                fill="none"
                stroke="#000000"
                strokeOpacity="0.22"
                strokeWidth="2"
              />

              {/* Center Electrode Tip */}
              <circle
                cx="160"
                cy="148"
                r="17"
                fill={profile.electrodeColor}
                stroke="#18181B"
                strokeWidth="3"
              />
              <circle cx="155" cy="143" r="5" fill="#FFFFFF" opacity="0.35" />

              {/* Soot / Carbon deposits */}
              {profile.sootSpecks && (
                <g fill="#09090B" opacity="0.85">
                  <circle cx="122" cy="126" r="5" />
                  <circle cx="196" cy="132" r="6" />
                  <circle cx="136" cy="182" r="5.5" />
                  <circle cx="188" cy="176" r="4.5" />
                  <circle cx="154" cy="108" r="4" />
                  <circle cx="114" cy="158" r="4.5" />
                </g>
              )}

              {/* Detonation / Aluminum Blister Specks */}
              {profile.blisterSpecks && (
                <g>
                  <circle cx="134" cy="128" r="3.5" fill="#94A3B8" stroke="#1E293B" strokeWidth="1" />
                  <circle cx="186" cy="134" r="4" fill="#CBD5E1" stroke="#334155" strokeWidth="1" />
                  <circle cx="144" cy="174" r="3" fill="#94A3B8" stroke="#1E293B" strokeWidth="1" />
                  <circle cx="176" cy="170" r="3.5" fill="#E2E8F0" stroke="#334155" strokeWidth="1" />
                  <circle cx="164" cy="116" r="2.8" fill="#CBD5E1" stroke="#334155" strokeWidth="1" />
                </g>
              )}

              {/* Wet Fuel / Oil Gloss Highlights */}
              {profile.wetGloss && (
                <g>
                  <ellipse cx="138" cy="124" rx="14" ry="6" transform="rotate(-28 138 124)" fill="#FFFFFF" opacity="0.35" />
                  <ellipse cx="188" cy="166" rx="10" ry="4" transform="rotate(32 188 166)" fill="#38BDF8" opacity="0.32" />
                  <circle cx="204" cy="118" r="5" fill="#F59E0B" opacity="0.5" />
                </g>
              )}

              {/* Ground Electrode J-Strap curving over center electrode */}
              <path
                d="M 232 148 L 214 148 Q 204 148 194 148 L 154 148"
                fill="none"
                stroke="#18181B"
                strokeWidth="22"
                strokeLinecap="round"
              />
              <path
                d="M 232 148 L 156 148"
                fill="none"
                stroke={profile.strapTint}
                strokeWidth="14"
                strokeLinecap="round"
              />
              {/* Metallic highlight on ground strap */}
              <line
                x1="226"
                y1="144"
                x2="162"
                y2="144"
                stroke="#FFFFFF"
                strokeOpacity="0.3"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Oil sludge bridging the gap for oily-fouled */}
              {profile.oilBridge && (
                <path
                  d="M 148 142 Q 164 134 182 146 Q 170 162 148 154 Z"
                  fill="#0C0A09"
                  stroke="#44403C"
                  strokeWidth="2"
                />
              )}

              <text
                x="160"
                y="286"
                textAnchor="middle"
                fill="#A1A1AA"
                fontSize="11"
                fontWeight="900"
                fontFamily="monospace"
              >
                MACRO VIEW • CERAMIC INSULATOR &amp; ELECTRODE
              </text>
            </svg>
          </div>

          {/* Reading Interpretation */}
          <div className="flex flex-col justify-between gap-4 md:col-span-6">
            <div>
              <span
                className={`inline-flex items-center gap-1.5 border-2 px-2.5 py-1 text-xs font-black uppercase tracking-wider ${profile.toneClass}`}
              >
                {profile.bucket === "ideal" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {profile.badge}
              </span>
              <h3
                className="mt-2.5 text-2xl font-bold text-[#FFD700]"
                style={{
                  fontFamily: "var(--font-russo-one), 'Russo One', sans-serif",
                }}
              >
                {profile.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                {profile.summary}
              </p>
            </div>

            <div className="border-2 border-[#FFD700]/60 bg-black p-3.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#FFD700]">
                2-Stroke Tuner Tip
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-100">
                {profile.nextStep}
              </p>
            </div>
          </div>
        </div>

        {/* 4-Color 2-Stroke Reference Strip */}
        <div className="border-t-2 border-zinc-800 bg-black px-5 py-4">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-zinc-400">
            2-Stroke Plug Reading Reference Chart
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {REFERENCE_STRIP.map((ref) => {
              const active = ref.bucket === profile.bucket;
              return (
                <div
                  key={ref.bucket}
                  className={`flex flex-col items-center border-2 p-2.5 text-center ${
                    active
                      ? "border-[#FFD700] bg-[#FFD700]/15 shadow-[3px_3px_0px_0px_#FFD700]"
                      : "border-zinc-800 bg-zinc-950 opacity-75"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-9 w-9 rounded-full border-2 border-zinc-500"
                    style={{ background: ref.swatch }}
                  />
                  <span
                    className={`mt-2 text-xs font-black uppercase ${
                      active ? "text-[#FFD700]" : "text-white"
                    }`}
                  >
                    {ref.label}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-zinc-400">
                    {ref.sub}
                  </span>
                  {active && (
                    <span className="mt-1.5 bg-[#FFD700] px-1.5 py-0.5 text-[9px] font-black uppercase text-black">
                      Your Plug
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="border-2 border-[#FFD700] bg-[#FFD700] px-6 py-2 text-sm font-black uppercase tracking-wider text-black transition-colors hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              Reinstall Plug &amp; Return
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
