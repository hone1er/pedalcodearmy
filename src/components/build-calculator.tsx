"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  mopedBuilds,
  calculateTierTotal,
  type MopedBuild,
  type BuildTier,
} from "@/data/build-recipes";
import {
  ChevronRight,
  DollarSign,
  Gauge,
  Wrench,
  ExternalLink,
  Lightbulb,
  ShoppingCart,
  ArrowLeft,
  Zap,
} from "lucide-react";
import Link from "next/link";

function RetroBadge({
  children,
  color = "orange",
}: {
  children: React.ReactNode;
  color?: "orange" | "gold" | "black" | "green" | "blue";
}) {
  const colors = {
    orange: "bg-orange-500 text-black border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
    black: "bg-black text-[#FFD700] border-gray-700",
    green: "bg-green-700 text-white border-green-900",
    blue: "bg-blue-600 text-white border-blue-800",
  };
  return (
    <span
      className={`inline-block rounded-none border-2 border-b-4 px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function MopedSelector({
  onSelect,
}: {
  onSelect: (build: MopedBuild) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {mopedBuilds.map((build) => (
        <button
          key={build.id}
          type="button"
          onClick={() => onSelect(build)}
          className="group block w-full text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black"
        >
          <Card className="h-full overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <CardContent className="p-5">
              <RetroBadge color="black">{build.make}</RetroBadge>
              <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-gray-900">
                {build.displayName}
              </h3>
              <p className="mt-2 text-sm font-medium text-gray-700">
                {build.tiers.length} build tiers available
              </p>
              <div className="mt-4 flex items-center gap-2 font-black uppercase text-orange-700 group-hover:text-orange-800">
                View Builds <ChevronRight size={18} aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}

function TierSelector({
  build,
  onSelect,
  onBack,
  headingRef,
}: {
  build: MopedBuild;
  onSelect: (tier: BuildTier) => void;
  onBack: () => void;
  headingRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div>
      <div
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 flex items-center gap-4 border-4 border-black bg-white p-4 text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back to moped selection"
          className="rounded-none border-2 border-black bg-[#FFD700] p-2 text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <RetroBadge color="black">{build.make}</RetroBadge>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-gray-900">
            {build.displayName}
          </h2>
          <p className="mt-1 text-sm font-medium text-gray-700">
            Choose your performance tier. Each level builds on the previous
            &mdash; always start with a well-tuned stock setup.
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {build.tiers.map((tier, index) => {
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => onSelect(tier)}
              className="group block w-full text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black"
            >
              <Card className="overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div
                      className={`flex flex-col justify-center border-b-4 border-black p-6 md:w-52 md:border-b-0 md:border-r-4 ${
                        index === 0
                          ? "bg-green-700 text-white"
                          : index === 1
                            ? "bg-[#FFD700] text-black"
                            : "bg-orange-700 text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Zap size={24} aria-hidden="true" />
                        <span className="text-xl font-black uppercase">
                          Tier {index + 1}
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-sm font-bold ${
                          index === 1 ? "text-gray-900" : "text-white"
                        }`}
                      >
                        {tier.name}
                      </p>
                    </div>

                    <div className="flex-1 p-6">
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-1">
                          <DollarSign
                            size={16}
                            className="text-green-700"
                            aria-hidden="true"
                          />
                          <span className="font-bold text-gray-900">
                            {tier.priceRange}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Gauge
                            size={16}
                            className="text-blue-700"
                            aria-hidden="true"
                          />
                          <span className="font-bold text-gray-900">
                            {tier.estimatedSpeed}
                          </span>
                        </div>
                      </div>

                      <p className="mt-2 text-lg font-black text-gray-900">
                        {tier.tagline}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">
                        {tier.description.slice(0, 120)}...
                      </p>

                      <div className="mt-4 flex items-center gap-2 font-black uppercase text-orange-700 group-hover:text-orange-800">
                        See Parts List{" "}
                        <ChevronRight size={18} aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PartsBreakdown({
  build,
  tier,
  onBack,
  onStartOver,
  headingRef,
}: {
  build: MopedBuild;
  tier: BuildTier;
  onBack: () => void;
  onStartOver: () => void;
  headingRef: RefObject<HTMLDivElement>;
}) {
  const totals = calculateTierTotal(tier);
  const tierIndex = build.tiers.findIndex((t) => t.id === tier.id);

  return (
    <div>
      <div
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 flex items-center gap-4 border-4 border-black bg-white p-4 text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back to build tiers"
          className="rounded-none border-2 border-black bg-[#FFD700] p-2 text-black transition-colors hover:bg-yellow-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div>
          <div className="flex flex-wrap gap-2">
            <RetroBadge color="black">{build.make}</RetroBadge>
            <RetroBadge
              color={
                tierIndex === 0
                  ? "green"
                  : tierIndex === 1
                    ? "gold"
                    : "orange"
              }
            >
              {tier.name}
            </RetroBadge>
          </div>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-gray-900">
            {tier.tagline}
          </h2>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-[#FFD700] text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <DollarSign size={24} className="mx-auto mb-1" aria-hidden="true" />
              <p className="text-2xl font-black">
                ${totals.min.toLocaleString()}
                {totals.min !== totals.max &&
                  ` - $${totals.max.toLocaleString()}`}
              </p>
              <p className="text-xs font-bold uppercase">
                Estimated Cost
                {totals.optionalCount > 0 ? " (incl. optional)" : ""}
              </p>
              {totals.optionalCount > 0 && (
                <p className="mt-0.5 text-xs font-semibold text-gray-900">
                  Core parts: ${totals.requiredMin.toLocaleString()}
                  {totals.requiredMin !== totals.requiredMax &&
                    ` - $${totals.requiredMax.toLocaleString()}`}
                </p>
              )}
            </div>
            <div className="text-center">
              <Gauge size={24} className="mx-auto mb-1" aria-hidden="true" />
              <p className="text-2xl font-black">{tier.estimatedSpeed}</p>
              <p className="text-xs font-bold uppercase">Target Speed</p>
            </div>
            <div className="text-center">
              <Wrench size={24} className="mx-auto mb-1" aria-hidden="true" />
              <p className="text-2xl font-black">{tier.parts.length}</p>
              <p className="text-xs font-bold uppercase">
                Parts
                {totals.optionalCount > 0
                  ? ` (${totals.optionalCount} optional)`
                  : ""}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-6">
          <p className="font-medium text-gray-800">{tier.description}</p>
        </CardContent>
      </Card>

      {/* Parts List */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2 border-b-4 border-black bg-black p-4 text-[#FFD700]">
          <ShoppingCart size={20} aria-hidden="true" />
          <h3 className="font-black uppercase tracking-wide">Parts List</h3>
        </div>
        <CardContent className="p-0">
          <div className="divide-y-2 divide-gray-200">
            {tier.parts.map((part, index) => (
              <div
                key={index}
                className="flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-gray-50"
              >
                <div className="min-w-[200px] flex-1">
                  <p className="font-bold text-gray-900">
                    {part.name}
                    {part.optional && (
                      <span className="ml-2 inline-block border border-black bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-black">
                        Optional
                      </span>
                    )}
                  </p>
                  {part.notes && (
                    <p className="text-sm text-gray-600">{part.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-green-700">
                    {part.priceRange ?? `$${part.price}`}
                  </span>
                  {part.vendorUrl && (
                    <Link
                      href={part.vendorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-none border-2 border-black bg-[#FFD700] px-2.5 py-1 text-xs font-black uppercase text-black transition-colors hover:bg-yellow-400"
                    >
                      {part.vendor}{" "}
                      <ExternalLink
                        size={12}
                        className="ml-1 inline"
                        aria-hidden="true"
                      />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tips */}
      {tier.tips && tier.tips.length > 0 && (
        <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-white text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 border-b-4 border-black bg-blue-600 p-4 text-white">
            <Lightbulb size={20} aria-hidden="true" />
            <h3 className="font-black uppercase tracking-wide">Pro Tips</h3>
          </div>
          <CardContent className="p-6">
            <ul className="space-y-3">
              {tier.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-gray-800">{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Vendor Links */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-gray-50 text-gray-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-6">
          <h4 className="mb-4 font-black uppercase">Where to Buy</h4>
          <div className="flex flex-wrap gap-3">
            <Link
              href="https://www.treatland.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border-2 border-black bg-[#FFD700] px-4 py-2 font-bold text-black transition-colors hover:bg-yellow-400"
            >
              Treatland{" "}
              <ExternalLink
                size={14}
                className="ml-1 inline"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="https://www.1977mopeds.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border-2 border-black bg-white px-4 py-2 font-bold text-black transition-colors hover:bg-gray-100"
            >
              1977 Mopeds{" "}
              <ExternalLink
                size={14}
                className="ml-1 inline"
                aria-hidden="true"
              />
            </Link>
            <Link
              href="https://www.mopedarmy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border-2 border-black bg-white px-4 py-2 font-bold text-black transition-colors hover:bg-gray-100"
            >
              Moped Army Forums{" "}
              <ExternalLink
                size={14}
                className="ml-1 inline"
                aria-hidden="true"
              />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="rounded-none border-2 border-black bg-white font-bold text-black hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="mr-2" aria-hidden="true" />
          View Other Tiers
        </Button>
        <Button
          type="button"
          onClick={onStartOver}
          className="rounded-none border-2 border-black bg-[#FFD700] font-bold text-black hover:bg-yellow-400"
        >
          Choose Different Moped
        </Button>
      </div>
    </div>
  );
}

export default function BuildCalculator() {
  const [selectedBuild, setSelectedBuild] = useState<MopedBuild | null>(null);
  const [selectedTier, setSelectedTier] = useState<BuildTier | null>(null);
  const stepHeadingRef = useRef<HTMLDivElement>(null);

  const stepKey = !selectedBuild
    ? "select-build"
    : !selectedTier
      ? `select-tier:${selectedBuild.id}`
      : `parts:${selectedBuild.id}:${selectedTier.id}`;
  const prevStepKeyRef = useRef(stepKey);

  useEffect(() => {
    if (prevStepKeyRef.current === stepKey) return;
    prevStepKeyRef.current = stepKey;

    const headingEl = stepHeadingRef.current;
    if (!headingEl) return;
    headingEl.focus({ preventScroll: true });
    headingEl.scrollIntoView({ block: "start" });
  }, [stepKey]);

  const handleSelectBuild = (build: MopedBuild) => {
    setSelectedBuild(build);
    setSelectedTier(null);
  };

  const handleSelectTier = (tier: BuildTier) => {
    setSelectedTier(tier);
  };

  const handleBackFromTier = () => {
    setSelectedTier(null);
  };

  const handleBackFromBuild = () => {
    setSelectedBuild(null);
    setSelectedTier(null);
  };

  const handleStartOver = () => {
    setSelectedBuild(null);
    setSelectedTier(null);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {!selectedBuild ? (
        <>
          <div
            ref={stepHeadingRef}
            tabIndex={-1}
            className="mb-8 border-4 border-black bg-white p-6 text-center text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus:outline-none"
          >
            <h2 className="mb-2 text-3xl font-black uppercase tracking-tight md:text-4xl">
              Choose Your Moped
            </h2>
            <p className="text-gray-700">
              Select your moped model to see recommended build paths and parts
              lists for each performance tier.
            </p>
          </div>
          <MopedSelector onSelect={handleSelectBuild} />
        </>
      ) : !selectedTier ? (
        <TierSelector
          build={selectedBuild}
          onSelect={handleSelectTier}
          onBack={handleBackFromBuild}
          headingRef={stepHeadingRef}
        />
      ) : (
        <PartsBreakdown
          build={selectedBuild}
          tier={selectedTier}
          onBack={handleBackFromTier}
          onStartOver={handleStartOver}
          headingRef={stepHeadingRef}
        />
      )}

      {/* Troubleshooter Cross-Link Banner */}
      <div className="mt-8 flex flex-col items-center justify-between gap-4 border-4 border-black bg-black p-5 text-[#FFD700] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:flex-row">
        <div>
          <p className="text-lg font-black uppercase tracking-tight">
            Moped won&apos;t start?
          </p>
          <p className="text-sm text-white/80">
            Dial in spark, fuel, and compression first before bolting on speed
            parts.
          </p>
        </div>
        <Link
          href="/troubleshooter"
          className="inline-flex shrink-0 items-center gap-2 rounded-none border-2 border-[#FFD700] bg-[#FFD700] px-5 py-2.5 text-sm font-black uppercase text-black transition-colors hover:bg-yellow-400"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          Try the Troubleshooter
        </Link>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 rounded-none border-4 border-black bg-white p-4 text-center text-sm text-gray-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <p>
          <strong>Note:</strong> Prices are estimates and may vary. Always
          verify compatibility with your specific model year and configuration.
          Links are provided for convenience - we are not affiliated with these
          vendors.
        </p>
      </div>
    </div>
  );
}
