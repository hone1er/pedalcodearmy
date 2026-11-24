"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Instagram, Wrench, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MemberMoped = {
  name: string;
  image: string;
  setup?: Record<string, string | undefined>;
};

type LightboxState = {
  ownerName: string;
  mopeds: MemberMoped[];
  index: number;
};

type EastBayMember = {
  name: string;
  bio: string;
  instagram: string;
  youtube: string;
  img: string;
  mopeds: MemberMoped[];
};

type EuropeanMember = {
  name: string;
  country: string;
  image: string;
  instagram: string;
  bio: string;
  mopeds: MemberMoped[];
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const EUROPEAN_MEMBERS: EuropeanMember[] = [
  {
    name: "Driss",
    country: "France",
    image: "/images/euros/driss/driss.jpeg",
    instagram: "driss_blz",
    bio: "Our first French dude!",
    mopeds: [
      { name: "Maxi S", image: "/images/euros/driss/blue_maxi.jpeg" },
      { name: "Maxi (Silver)", image: "/images/euros/driss/silver_maxi.jpeg" },
      { name: "Maxi (Black)", image: "/images/euros/driss/black_maxi.jpeg" },
      { name: "Maxi (Grey)", image: "/images/euros/driss/grey_maxi.jpeg" },
      { name: "Puch Magnum", image: "/images/euros/driss/puch_magnum.jpeg" },
      {
        name: "Puch Magnum (Red)",
        image: "/images/euros/driss/red_magnum.jpeg",
      },
      { name: "X-10s", image: "/images/euros/driss/x_10s.jpeg" },
    ],
  },
  {
    name: "Nils Rösner",
    country: "Germany",
    image: "",
    instagram: "rosnernils",
    bio: "Representing Germany!",
    mopeds: [
      {
        name: "KTM Hobby & Piaggio Ciao",
        image: "/images/euros/nils/ktm_ciao.jpeg",
      },
      {
        name: "Zündapp Bergsteiger/434",
        image: "/images/euros/nils/zundapp.jpeg",
      },
    ],
  },
];

const MEMBERS: EastBayMember[] = [
  {
    name: "Joe Villavicencio",
    bio: "Founder, moped whisperer, and designated 'are we lost?' guy",
    mopeds: [
      {
        name: "Magnum II",
        image: "/images/honesMopeds/magnum.JPG",
        setup: {
          kit: "puch treat kit party - 70cc TCCD kit / CUSTOM cut head",
          carb: "Dellorto 15.15 SHA",
          pipe: "Black Pipe",
        },
      },
      {
        name: "Derbi Variant TT",
        image: "/images/honesMopeds/derbi.jpeg",
        setup: {
          kit: "stock",
          carb: "Dellorto 15.15 SHA",
          pipe: "Tecno Boss",
          variator: "Stock",
        },
      },
      {
        name: "Derbi Variant SL '79",
        image: "/images/honesMopeds/blackderbisl.jpeg",
        setup: {
          kit: "Autisa 65cc",
          carb: "Dellorto 15.15 SHA",
          pipe: "Estoril",
          variator: "Hobbit X-treme clutch bell w/ TJT",
        },
      },
      {
        name: "Derbi Variant SL '86",
        image: "/images/honesMopeds/whitederbisl.jpeg",
        setup: {
          kit: "stock",
          carb: "Dellorto 15.15 SHA",
          pipe: "Tecno Boss",
          variator: "Stock",
        },
      },
      {
        name: "Derbi RD 50",
        image: "/images/honesMopeds/rd50.jpeg",
        setup: {
          kit: "Metrakit 65cc",
          carb: "Dellorto 15.15 SHA",
          pipe: "Stock",
          variator: "TJT",
        },
      },
      {
        name: "Maxi N",
        image: "/images/honesMopeds/maxi_n.JPG",
        setup: {
          kit: "Mystery Kit",
          carb: "Dellorto 15.15 SHA",
          pipe: "Tecno Boss",
        },
      },
      {
        name: "Little Yellow Maxi",
        image: "/images/honesMopeds/maxi.JPG",
        setup: {
          kit: "Stock",
          carb: "Dellorto 14 SHA",
          pipe: "Tecno Boss",
        },
      },
      {
        name: "Hobbit PA 50I",
        image: "/images/honesMopeds/redracehobbit.jpeg",
        setup: {
          kit: "Polini 70cc",
          carb: "Mikuni VM20",
          pipe: "Custom Crank Pipes",
          variator: "Treats",
        },
      },
      {
        name: "Hobbit PA 50II",
        image: "/images/honesMopeds/yellowhobbit.jpeg",
        setup: {
          kit: "DR kit",
          carb: "Stock clone",
          pipe: "Stock pipe",
          variator: "Treats",
        },
      },
      {
        name: "Hobbit PA 50II (CRASHED - RIP)",
        image: "/images/honesMopeds/hobbit.jpeg",
        setup: {
          kit: "Stocko shocko",
          carb: "Mikuni VM20",
          pipe: "Proma",
          variator: "Treats Prototype",
        },
      },
      {
        name: "Garelli SSXL LTD",
        image: "/images/honesMopeds/ssxl.jpeg",
      },
    ],
    instagram: "hone1er",
    youtube: "https://www.youtube.com/@joevillavicencio4718",
    img: "hone.jpeg",
  },
  {
    name: "Joshua Willing",
    bio: "Early member, moped mechanic extraordinaire, and collector of 'spare parts'",
    mopeds: [
      {
        name: "Maxi",
        image: "/images/jdubsMopeds/maxi.JPG",
      },
    ],
    instagram: "femoresroom",
    youtube: "https://www.youtube.com/@benalbuckets",
    img: "jdub.jpg",
  },
  {
    name: "Isabel Muñoz",
    bio: "First lady of the group, moped rider, and snack provider",
    mopeds: [
      {
        name: "Hobbit",
        image: "/images/izzysMopeds/redhobbit.jpeg",
      },
    ],
    instagram: "isssssabel_m",
    youtube: "https://www.youtube.com/@benalbuckets",
    img: "izzy.jpeg",
  },
  {
    name: "Alex Baranda",
    bio: "Early member, another skater, and the researcher of moped mods",
    mopeds: [
      {
        name: "Dirt Hobbit",
        image: "/images/alexsMopeds/dirthobbit.jpeg",
      },
    ],
    instagram: "sensifunoner",
    youtube: "https://www.youtube.com/@benalbuckets",
    img: "alex.jpeg",
  },
  {
    name: "Lydia Vieyra",
    bio: "Hobbit enjoyer and the group's morale booster",
    mopeds: [
      {
        name: "Maxi",
        image: "/images/alexsMopeds/maxi.jpeg",
      },
    ],
    instagram: "lydia_deets_",
    youtube: "https://www.youtube.com/@benalbuckets",
    img: "lydia.jpeg",
  },
];

function MopedTile({
  moped,
  ownerName,
  onSelect,
}: {
  moped: MemberMoped;
  ownerName: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`View ${moped.name} owned by ${ownerName}`}
      className="group overflow-hidden rounded-none border-4 border-black bg-amber-50 p-2 text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD700]"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h4 className="truncate text-base font-black uppercase tracking-tight text-gray-900">
          {moped.name}
        </h4>
        {moped.setup && (
          <span className="shrink-0 border-2 border-black bg-[#FFD700] px-1.5 py-0.5 text-[10px] font-black uppercase text-black">
            Specs
          </span>
        )}
      </div>
      <div className="relative aspect-[4/3] w-full overflow-hidden border-2 border-black bg-white">
        <Image
          src={moped.image}
          alt={`${moped.name} owned by ${ownerName}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-contain transition-transform duration-200 group-hover:scale-105"
        />
      </div>
    </button>
  );
}

export default function MemberShowcase() {
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const selectedMoped = lightbox
    ? (lightbox.mopeds[lightbox.index] ?? null)
    : null;

  const openLightbox = (
    ownerName: string,
    mopeds: MemberMoped[],
    index: number,
  ) => {
    setShowSetup(false);
    setLightbox({ ownerName, mopeds, index });
  };

  const handlePrev = () => {
    setLightbox((prev) => {
      if (!prev || prev.mopeds.length === 0) return prev;
      const nextIndex =
        prev.index === 0 ? prev.mopeds.length - 1 : prev.index - 1;
      return { ...prev, index: nextIndex };
    });
    setShowSetup(false);
  };

  const handleNext = () => {
    setLightbox((prev) => {
      if (!prev || prev.mopeds.length === 0) return prev;
      const nextIndex =
        prev.index === prev.mopeds.length - 1 ? 0 : prev.index + 1;
      return { ...prev, index: nextIndex };
    });
    setShowSetup(false);
  };

  useEffect(() => {
    if (!lightbox) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox]);

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid gap-10" id="members">
        {MEMBERS.map((member) => (
          <Card
            key={member.name}
            className="rounded-none border-4 border-black bg-white text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <CardContent className="p-6">
              <div className="flex flex-col gap-8 md:flex-row">
                <div className="md:w-1/3">
                  <div className="relative mx-auto mb-4 aspect-square w-full max-w-[260px] overflow-hidden rounded-full border-4 border-black bg-amber-50">
                    <Image
                      src={`/images/${member.img}`}
                      alt={member.name}
                      fill
                      sizes="(max-width: 768px) 260px, 280px"
                      className="object-cover object-center"
                    />
                  </div>
                  <h2 className="mb-2 text-center text-2xl font-black uppercase tracking-tight text-gray-900">
                    {member.name}
                  </h2>
                  <p className="mb-4 text-center text-gray-700">{member.bio}</p>
                  <div className="flex justify-center gap-4">
                    <Link
                      href={`https://instagram.com/${member.instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${member.name} on Instagram`}
                      className="border-2 border-black bg-white p-2 text-pink-600 transition-colors hover:bg-pink-50"
                    >
                      <Instagram size={22} aria-hidden="true" />
                    </Link>
                    <Link
                      href={member.youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${member.name} on YouTube`}
                      className="border-2 border-black bg-white p-2 text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Youtube size={22} aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                <div className="md:w-2/3">
                  <h3 className="mb-4 inline-block border-2 border-black bg-[#FFD700] px-3 py-1 text-lg font-black uppercase tracking-wide text-black">
                    Moped Collection ({member.mopeds.length})
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {member.mopeds.map((moped, mopedIndex) => (
                      <MopedTile
                        key={`${member.name}-${moped.name}-${mopedIndex}`}
                        moped={moped}
                        ownerName={member.name}
                        onSelect={() =>
                          openLightbox(member.name, member.mopeds, mopedIndex)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* European Division */}
      <div className="mt-16">
        <div className="mx-auto mb-10 max-w-2xl border-4 border-[#FFD700] bg-black p-6 text-center text-[#FFD700] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
          <h2 className="mb-2 text-3xl font-black uppercase tracking-tight">
            European Division
          </h2>
          <p className="text-white/85">
            Shoutout to our European members and pledges bringing the two-stroke
            moped love across the pond!
          </p>
        </div>

        <div className="grid gap-10" id="european-members">
          {EUROPEAN_MEMBERS.map((member) => (
            <Card
              key={member.name}
              className="rounded-none border-4 border-black bg-white text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
            >
              <CardContent className="p-6">
                <div className="flex flex-col gap-8 md:flex-row">
                  <div className="md:w-1/3">
                    {member.image ? (
                      <div className="relative mx-auto mb-4 aspect-square w-full max-w-[260px] overflow-hidden rounded-full border-4 border-black bg-amber-50">
                        <Image
                          src={member.image}
                          alt={member.name}
                          fill
                          sizes="(max-width: 768px) 260px, 280px"
                          className="object-cover object-top"
                        />
                      </div>
                    ) : (
                      <div
                        role="img"
                        aria-label={`${member.name} avatar`}
                        className="mx-auto mb-4 flex aspect-square w-full max-w-[220px] items-center justify-center rounded-full border-4 border-black bg-[#FFD700] text-5xl font-black text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        {getInitials(member.name)}
                      </div>
                    )}
                    <h2 className="mb-2 text-center text-2xl font-black uppercase tracking-tight text-gray-900">
                      {member.name} &mdash; {member.country}
                    </h2>
                    <p className="mb-4 text-center text-gray-700">
                      {member.bio}
                    </p>
                    <div className="flex justify-center">
                      <Link
                        href={`https://instagram.com/${member.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Visit ${member.name} on Instagram`}
                        className="border-2 border-black bg-white p-2 text-pink-600 transition-colors hover:bg-pink-50"
                      >
                        <Instagram size={22} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>

                  <div className="md:w-2/3">
                    <h3 className="mb-4 inline-block border-2 border-black bg-[#FFD700] px-3 py-1 text-lg font-black uppercase tracking-wide text-black">
                      Moped Collection ({member.mopeds.length})
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {member.mopeds.map((moped, mopedIndex) => (
                        <MopedTile
                          key={`${member.name}-${moped.name}-${mopedIndex}`}
                          moped={moped}
                          ownerName={member.name}
                          onSelect={() =>
                            openLightbox(member.name, member.mopeds, mopedIndex)
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Controlled Lightbox Dialog */}
      <Dialog
        open={Boolean(lightbox && selectedMoped)}
        onOpenChange={(open) => {
          if (!open) {
            setLightbox(null);
            setShowSetup(false);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto rounded-none border-4 border-black bg-white p-6 text-gray-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          {lightbox && selectedMoped && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-2xl font-black uppercase tracking-tight text-gray-900">
                  {showSetup
                    ? `${selectedMoped.name}'s Setup`
                    : selectedMoped.name}
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold text-gray-600">
                  {lightbox.ownerName} &bull; Photo {lightbox.index + 1} of{" "}
                  {lightbox.mopeds.length}
                </DialogDescription>
              </DialogHeader>

              {!showSetup ? (
                <div className="relative h-[60vh] w-full border-2 border-black bg-gray-100">
                  {lightbox.mopeds.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handlePrev}
                      aria-label="Previous photo"
                      className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-none border-2 border-[#FFD700] bg-black/85 p-2 text-[#FFD700] hover:bg-black hover:text-[#FFD700]"
                    >
                      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  )}
                  <Image
                    src={selectedMoped.image}
                    alt={`${selectedMoped.name} owned by ${lightbox.ownerName}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 768px"
                    className="object-contain"
                  />
                  {lightbox.mopeds.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleNext}
                      aria-label="Next photo"
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-none border-2 border-[#FFD700] bg-black/85 p-2 text-[#FFD700] hover:bg-black hover:text-[#FFD700]"
                    >
                      <ArrowRight className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-black bg-[#FFD700] p-4 text-black">
                  {selectedMoped.setup && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {Object.entries(selectedMoped.setup).map(
                        ([key, value]) =>
                          value ? (
                            <div
                              key={key}
                              className="border-2 border-black bg-white p-3"
                            >
                              <h4 className="text-xs font-black uppercase tracking-wider text-gray-600">
                                {key}
                              </h4>
                              <p className="mt-1 font-bold text-gray-900">
                                {value}
                              </p>
                            </div>
                          ) : null,
                      )}
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:justify-between">
                {lightbox.mopeds.length > 1 && (
                  <p className="self-center text-xs font-bold uppercase text-gray-500">
                    Tip: Use Left / Right arrow keys to browse
                  </p>
                )}
                {selectedMoped.setup && (
                  <Button
                    type="button"
                    onClick={() => setShowSetup((prev) => !prev)}
                    className="rounded-none border-2 border-black bg-[#FFD700] font-black uppercase text-black hover:bg-yellow-400"
                  >
                    <Wrench className="mr-2 h-4 w-4" aria-hidden="true" />
                    {showSetup ? "Back to Photo" : "Show Setup"}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
