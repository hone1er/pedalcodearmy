"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mopeds, uniqueMakes, uniqueOwners, type Moped } from "@/data/mopeds";
import { Instagram, X, Filter, Users, Bike } from "lucide-react";

type FilterState = {
  make: string;
  owner: string;
  hasSetup: boolean;
};

function RetroBadge({
  children,
  color = "orange",
}: {
  children: React.ReactNode;
  color?: "orange" | "gold" | "black";
}) {
  const colors = {
    orange: "bg-orange-500 text-white border-orange-700",
    gold: "bg-[#FFD700] text-black border-yellow-600",
    black: "bg-black text-[#FFD700] border-gray-700",
  };
  return (
    <span
      className={`inline-block rounded-none border-2 border-b-4 px-2 py-0.5 text-xs font-black uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  );
}

function MopedCard({
  moped,
  onSelect,
}: {
  moped: Moped;
  onSelect: (moped: Moped) => void;
}) {
  return (
    <Card className="group overflow-hidden rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <CardContent className="p-0">
        <div
          className="relative aspect-[4/3] cursor-pointer overflow-hidden"
          onClick={() => onSelect(moped)}
        >
          <Image
            src={moped.image}
            alt={moped.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {moped.setup && (
            <div className="absolute right-2 top-2">
              <RetroBadge color="gold">SPECS</RetroBadge>
            </div>
          )}
          {moped.country && (
            <div className="absolute left-2 top-2">
              <RetroBadge color="black">{moped.country}</RetroBadge>
            </div>
          )}
        </div>
        <div className="border-t-4 border-black bg-white p-3">
          <h3 className="truncate text-lg font-black uppercase tracking-tight">
            {moped.name}
          </h3>
          <p className="text-sm font-bold text-gray-600">
            {moped.make} {moped.model}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {moped.owner}
            </span>
            {moped.ownerInstagram && (
              <Link
                href={`https://instagram.com/${moped.ownerInstagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-500 hover:text-pink-600"
                onClick={(e) => e.stopPropagation()}
              >
                <Instagram size={16} />
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MopedDetailModal({
  moped,
  isOpen,
  onClose,
}: {
  moped: Moped | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!moped) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-none border-4 border-black bg-white p-0 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="relative aspect-video w-full">
          <Image
            src={moped.image}
            alt={moped.name}
            fill
            className="object-contain bg-gray-100"
          />
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-none border-2 border-black bg-white p-1 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="border-t-4 border-black p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight">
              {moped.name}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap gap-2">
              <RetroBadge color="black">{moped.make}</RetroBadge>
              <RetroBadge color="gold">{moped.model}</RetroBadge>
              {moped.country && (
                <RetroBadge color="orange">{moped.country}</RetroBadge>
              )}
            </div>

            <div className="flex items-center gap-3 rounded-none border-2 border-black bg-gray-50 p-3">
              {moped.ownerImage && (
                <div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-black">
                  <Image
                    src={moped.ownerImage}
                    alt={moped.owner}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <p className="font-bold">{moped.owner}</p>
                {moped.ownerInstagram && (
                  <Link
                    href={`https://instagram.com/${moped.ownerInstagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-pink-500 hover:text-pink-600"
                  >
                    <Instagram size={14} />@{moped.ownerInstagram}
                  </Link>
                )}
              </div>
            </div>

            {moped.setup && (
              <div className="rounded-none border-2 border-black bg-[#FFD700] p-4">
                <h4 className="mb-3 font-black uppercase tracking-wide">
                  Build Specs
                </h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {moped.setup.kit && (
                    <div>
                      <span className="text-xs font-bold uppercase text-gray-700">
                        Kit
                      </span>
                      <p className="font-semibold">{moped.setup.kit}</p>
                    </div>
                  )}
                  {moped.setup.carb && (
                    <div>
                      <span className="text-xs font-bold uppercase text-gray-700">
                        Carb
                      </span>
                      <p className="font-semibold">{moped.setup.carb}</p>
                    </div>
                  )}
                  {moped.setup.pipe && (
                    <div>
                      <span className="text-xs font-bold uppercase text-gray-700">
                        Pipe
                      </span>
                      <p className="font-semibold">{moped.setup.pipe}</p>
                    </div>
                  )}
                  {moped.setup.variator && (
                    <div>
                      <span className="text-xs font-bold uppercase text-gray-700">
                        Variator
                      </span>
                      <p className="font-semibold">{moped.setup.variator}</p>
                    </div>
                  )}
                  {moped.setup.otherMods && (
                    <div className="sm:col-span-2">
                      <span className="text-xs font-bold uppercase text-gray-700">
                        Other Mods
                      </span>
                      <p className="font-semibold">{moped.setup.otherMods}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  mopedCount,
}: {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string | boolean) => void;
  onReset: () => void;
  mopedCount: number;
}) {
  const hasActiveFilters =
    filters.make !== "" || filters.owner !== "" || filters.hasSetup;

  return (
    <div className="rounded-none border-4 border-black bg-white p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-black uppercase tracking-wide">
          <Filter size={18} />
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="text-xs font-bold uppercase text-orange-500 hover:text-orange-600"
          >
            Reset
          </button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
            Make
          </label>
          <select
            value={filters.make}
            onChange={(e) => onFilterChange("make", e.target.value)}
            className="w-full rounded-none border-2 border-black bg-white p-2 font-semibold focus:border-[#FFD700] focus:outline-none"
          >
            <option value="">All Makes</option>
            {uniqueMakes.map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase text-gray-600">
            Owner
          </label>
          <select
            value={filters.owner}
            onChange={(e) => onFilterChange("owner", e.target.value)}
            className="w-full rounded-none border-2 border-black bg-white p-2 font-semibold focus:border-[#FFD700] focus:outline-none"
          >
            <option value="">All Owners</option>
            {uniqueOwners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasSetup}
              onChange={(e) => onFilterChange("hasSetup", e.target.checked)}
              className="h-4 w-4 rounded-none border-2 border-black accent-[#FFD700]"
            />
            <span className="text-sm font-bold">With Build Specs Only</span>
          </label>
        </div>
      </div>

      <div className="mt-4 border-t-2 border-black pt-4">
        <p className="text-center text-sm font-bold">
          Showing{" "}
          <span className="text-[#FFD700] text-stroke">{mopedCount}</span> mopeds
        </p>
      </div>
    </div>
  );
}

function StatsBar() {
  const totalMopeds = mopeds.length;
  const totalOwners = uniqueOwners.length;
  const totalMakes = uniqueMakes.length;
  const withSpecs = mopeds.filter((m) => m.setup).length;

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      {[
        { label: "Total Mopeds", value: totalMopeds, icon: Bike },
        { label: "Owners", value: totalOwners, icon: Users },
        { label: "Makes", value: totalMakes, icon: Filter },
        { label: "With Specs", value: withSpecs, icon: Filter },
      ].map((stat) => (
        <div
          key={stat.label}
          className="rounded-none border-4 border-black bg-white p-4 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          <stat.icon className="mx-auto mb-2 h-6 w-6 text-[#FFD700]" />
          <p className="text-2xl font-black">{stat.value}</p>
          <p className="text-xs font-bold uppercase text-gray-600">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function FleetGallery() {
  const [filters, setFilters] = useState<FilterState>({
    make: "",
    owner: "",
    hasSetup: false,
  });
  const [selectedMoped, setSelectedMoped] = useState<Moped | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredMopeds = useMemo(() => {
    return mopeds.filter((moped) => {
      if (filters.make && moped.make !== filters.make) return false;
      if (filters.owner && moped.owner !== filters.owner) return false;
      if (filters.hasSetup && !moped.setup) return false;
      return true;
    });
  }, [filters]);

  const handleFilterChange = (
    key: keyof FilterState,
    value: string | boolean
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({ make: "", owner: "", hasSetup: false });
  };

  const handleSelectMoped = (moped: Moped) => {
    setSelectedMoped(moped);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMoped(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <StatsBar />

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar */}
        <div className="w-full lg:w-64 lg:flex-shrink-0">
          <div className="lg:sticky lg:top-24">
            <FilterSidebar
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              mopedCount={filteredMopeds.length}
            />
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="flex-1">
          {filteredMopeds.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-none border-4 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div className="text-center">
                <p className="text-xl font-black uppercase">No mopeds found</p>
                <p className="mt-2 text-gray-600">
                  Try adjusting your filters
                </p>
                <Button
                  onClick={handleResetFilters}
                  className="mt-4 rounded-none border-2 border-black bg-[#FFD700] font-bold text-black hover:bg-yellow-400"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMopeds.map((moped) => (
                <MopedCard
                  key={moped.id}
                  moped={moped}
                  onSelect={handleSelectMoped}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <MopedDetailModal
        moped={selectedMoped}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
