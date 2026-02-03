"use client";

import { useState } from "react";
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
    orange: "bg-orange-500 text-white border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
    black: "bg-black text-[#FFD700] border-gray-700",
    green: "bg-green-500 text-white border-green-700",
    blue: "bg-blue-500 text-white border-blue-700",
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
        <Card
          key={build.id}
          className="group cursor-pointer overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          onClick={() => onSelect(build)}
        >
          <CardContent className="p-5">
            <RetroBadge color="black">{build.make}</RetroBadge>
            <h3 className="mt-3 text-xl font-black uppercase tracking-tight">
              {build.displayName}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {build.tiers.length} build tiers available
            </p>
            <div className="mt-4 flex items-center gap-2 font-bold text-orange-500 group-hover:text-orange-600">
              View Builds <ChevronRight size={18} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TierSelector({
  build,
  onSelect,
  onBack,
}: {
  build: MopedBuild;
  onSelect: (tier: BuildTier) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-none border-2 border-black bg-white p-2 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <RetroBadge color="black">{build.make}</RetroBadge>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
            {build.displayName}
          </h2>
        </div>
      </div>

      <p className="mb-6 text-gray-600">
        Choose your performance tier. Each level builds on the previous -
        always start with a well-tuned stock setup.
      </p>

      <div className="grid gap-6">
        {build.tiers.map((tier, index) => {
          return (
            <Card
              key={tier.id}
              className="group cursor-pointer overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
              onClick={() => onSelect(tier)}
            >
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  <div
                    className={`flex flex-col justify-center border-b-4 border-black p-6 md:w-48 md:border-b-0 md:border-r-4 ${
                      index === 0
                        ? "bg-green-500"
                        : index === 1
                          ? "bg-[#FFD700]"
                          : "bg-orange-500"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap
                        size={24}
                        className={index === 1 ? "text-black" : "text-white"}
                      />
                      <span
                        className={`text-xl font-black uppercase ${index === 1 ? "text-black" : "text-white"}`}
                      >
                        Tier {index + 1}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-sm font-bold ${index === 1 ? "text-gray-800" : "text-white/80"}`}
                    >
                      {tier.name}
                    </p>
                  </div>

                  <div className="flex-1 p-6">
                    <div className="flex flex-wrap gap-3">
                      <div className="flex items-center gap-1">
                        <DollarSign size={16} className="text-green-600" />
                        <span className="font-bold">{tier.priceRange}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Gauge size={16} className="text-blue-600" />
                        <span className="font-bold">{tier.estimatedSpeed}</span>
                      </div>
                    </div>

                    <p className="mt-2 text-lg font-black">{tier.tagline}</p>
                    <p className="mt-1 text-sm text-gray-600">
                      {tier.description.slice(0, 120)}...
                    </p>

                    <div className="mt-4 flex items-center gap-2 font-bold text-orange-500 group-hover:text-orange-600">
                      See Parts List <ChevronRight size={18} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
}: {
  build: MopedBuild;
  tier: BuildTier;
  onBack: () => void;
  onStartOver: () => void;
}) {
  const totals = calculateTierTotal(tier);
  const tierIndex = build.tiers.findIndex((t) => t.id === tier.id);

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-none border-2 border-black bg-white p-2 hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex gap-2">
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
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight">
            {tier.tagline}
          </h2>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-[#FFD700] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center">
              <DollarSign size={24} className="mx-auto mb-1" />
              <p className="text-2xl font-black">
                ${totals.min.toLocaleString()}
                {totals.min !== totals.max && ` - $${totals.max.toLocaleString()}`}
              </p>
              <p className="text-xs font-bold uppercase">Estimated Cost</p>
            </div>
            <div className="text-center">
              <Gauge size={24} className="mx-auto mb-1" />
              <p className="text-2xl font-black">{tier.estimatedSpeed}</p>
              <p className="text-xs font-bold uppercase">Target Speed</p>
            </div>
            <div className="text-center">
              <Wrench size={24} className="mx-auto mb-1" />
              <p className="text-2xl font-black">{tier.parts.length}</p>
              <p className="text-xs font-bold uppercase">Parts</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-6">
          <p className="text-gray-700">{tier.description}</p>
        </CardContent>
      </Card>

      {/* Parts List */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-2 border-b-4 border-black bg-black p-4 text-[#FFD700]">
          <ShoppingCart size={20} />
          <h3 className="font-black uppercase tracking-wide">Parts List</h3>
        </div>
        <CardContent className="p-0">
          <div className="divide-y-2 divide-gray-200">
            {tier.parts.map((part, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex-1">
                  <p className="font-bold">{part.name}</p>
                  {part.notes && (
                    <p className="text-sm text-gray-500">{part.notes}</p>
                  )}
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <span className="font-black text-green-600">
                    {part.priceRange ?? `$${part.price}`}
                  </span>
                  {part.vendorUrl && (
                    <Link
                      href={part.vendorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-none border-2 border-black bg-[#FFD700] px-2 py-1 text-xs font-bold transition-colors hover:bg-yellow-400"
                    >
                      {part.vendor} <ExternalLink size={12} className="ml-1 inline" />
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
        <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center gap-2 border-b-4 border-black bg-blue-500 p-4 text-white">
            <Lightbulb size={20} />
            <h3 className="font-black uppercase tracking-wide">Pro Tips</h3>
          </div>
          <CardContent className="p-6">
            <ul className="space-y-3">
              {tier.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Vendor Links */}
      <Card className="mb-6 overflow-hidden rounded-none border-4 border-black bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <CardContent className="p-6">
          <h4 className="mb-4 font-black uppercase">Where to Buy</h4>
          <div className="flex flex-wrap gap-3">
            <Link
              href="https://www.treatland.tv"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border-2 border-black bg-[#FFD700] px-4 py-2 font-bold transition-colors hover:bg-yellow-400"
            >
              Treatland <ExternalLink size={14} className="ml-1 inline" />
            </Link>
            <Link
              href="https://www.1977mopeds.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border-2 border-black bg-white px-4 py-2 font-bold transition-colors hover:bg-gray-100"
            >
              1977 Mopeds <ExternalLink size={14} className="ml-1 inline" />
            </Link>
            <Link
              href="https://www.mopedarmy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-none border-2 border-black bg-white px-4 py-2 font-bold transition-colors hover:bg-gray-100"
            >
              Moped Army Forums <ExternalLink size={14} className="ml-1 inline" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="rounded-none border-2 border-black font-bold hover:bg-gray-100"
        >
          <ArrowLeft size={18} className="mr-2" />
          View Other Tiers
        </Button>
        <Button
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
          <div className="mb-8 text-center">
            <h2 className="mb-4 text-3xl font-black uppercase tracking-tight md:text-4xl">
              Choose Your Moped
            </h2>
            <p className="text-gray-600">
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
        />
      ) : (
        <PartsBreakdown
          build={selectedBuild}
          tier={selectedTier}
          onBack={handleBackFromTier}
          onStartOver={handleStartOver}
        />
      )}

      {/* Disclaimer */}
      <div className="mt-8 rounded-none border-2 border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
        <p>
          <strong>Note:</strong> Prices are estimates and may vary. Always verify
          compatibility with your specific model year and configuration. Links are
          provided for convenience - we are not affiliated with these vendors.
        </p>
      </div>
    </div>
  );
}
