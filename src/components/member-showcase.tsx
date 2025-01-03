"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BikeIcon as Motorcycle,
  Instagram,
  Youtube,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// This would typically come from a database or API
const members = [
  {
    name: "Joe Villavicencio",
    bio: "Founder, moped whisperer, and designated 'are we lost?' guy",
    mopeds: [
      {
        name: "Hobbit PA 50II",
        image: "/images/honesMopeds/hobbit.jpeg",
        setup: {
          kit: "Stocko shocko",
          carb: "Mikuni VM20",
          pipe: "Proma",
          variator: "Treats Prototype",
        },
      },
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
        image: "/images/honesMopeds/derbi.JPG",
        setup: {
          kit: "stock",
          carb: "Dellorto 15.15 SHA",
          pipe: "Tecno Boss",
          variator: "Stock",
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
    ],
    instagram: "hone1er",
    youtube: "https://www.youtube.com/@joevillavicencio4718",
    img: "hone.jpeg",
  },
  {
    name: "Kyle Militante",
    bio: "Co-founder, chief moped enthusiast, and occasional navigator",
    mopeds: [
      {
        name: "Magnum",
        image: "/images/milisMopeds/magnum.JPG",
      },
      {
        name: "Pinto",
        image: "/images/milisMopeds/pinto.JPG",
      },
      {
        name: "Hobbit",
        image: "/images/milisMopeds/hobbit.JPG",
      },
      {
        name: "Tomos",
        image: "/images/milisMopeds/tomos.JPG",
      },
    ],
    instagram: "milileaks",
    youtube: "https://www.youtube.com/@benalbuckets",
    img: "mili.jpeg",
  },

  {
    name: "Alex Baranda",
    bio: "Early member, another skater, and the researcher of moped mods",
    mopeds: [
      {
        name: "Maxi",
        image: "/images/alexsMopeds/maxi.jpeg",
      },
    ],
    instagram: "sensifunoner",
    youtube: "https://www.youtube.com/@benalbuckets",
    img: "placeholder.svg?height=300&width=400&text=Alex",
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
    img: "placeholder.svg?height=300&width=400&text=Joshua",
  },
];

export default function MemberShowcase() {
  const [selectedMoped, setSelectedMoped] = useState<{
    name: string;
    image: string;
    setup?: Record<string, string | undefined>;
  } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="mb-12 text-center text-4xl font-bold md:text-5xl">
        Meet the Pedal Code Army
      </h1>

      <div className="grid gap-12" id="members">
        {members.map((member, index) => (
          <Card key={index} className="bg-white shadow-xl">
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 md:flex-row">
                <div className="md:w-1/3">
                  <div className="relative mb-4 w-full overflow-hidden rounded-full pb-[100%]">
                    <Image
                      src={`/images/${member.img}`}
                      alt={member.name}
                      layout="fill"
                      objectFit="cover"
                      objectPosition="center"
                    />
                  </div>
                  <h2 className="mb-2 text-center text-2xl font-bold">
                    {member.name}
                  </h2>
                  <p className="mb-4 text-center text-gray-600">{member.bio}</p>
                  <div className="flex justify-center space-x-4">
                    <Link
                      href={`https://instagram.com/${member.instagram}`}
                      className="text-pink-500 hover:text-pink-600"
                    >
                      <Instagram size={24} />
                    </Link>
                    <Link
                      href={member.youtube}
                      className="text-red-500 hover:text-red-600"
                    >
                      <Youtube size={24} />
                    </Link>
                  </div>
                </div>
                <div className="md:w-2/3">
                  <h3 className="mb-4 text-xl font-semibold">
                    Moped Collection
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    {member.mopeds.map((moped, mopedIndex) => (
                      <div
                        key={mopedIndex}
                        className="overflow-hidden rounded-lg bg-gray-100 p-2 shadow-md"
                      >
                        <Dialog>
                          <DialogTrigger asChild>
                            <div>
                              <h2 className="mb-2 text-center text-xl font-semibold">
                                {moped.name}
                              </h2>
                              <div
                                className="relative cursor-pointer pb-[75%]"
                                onClick={() => {
                                  setShowSetup(false);
                                  setSelectedMoped(moped);
                                }}
                              >
                                <Image
                                  src={moped.image}
                                  alt={moped.name}
                                  layout="fill"
                                  objectFit="contain"
                                  objectPosition="center"
                                />
                              </div>
                            </div>
                          </DialogTrigger>
                          {selectedMoped && (
                            <DialogContent className="px-2">
                              {!showSetup ? (
                                <DialogHeader>
                                  <DialogTitle>
                                    {selectedMoped.name}
                                  </DialogTitle>
                                  <div className="relative h-[75vh] w-full">
                                    <Button
                                      variant={"ghost"}
                                      className="absolute left-2 top-[50%] z-10"
                                      onClick={() => {
                                        const currentIndex =
                                          member.mopeds.findIndex(
                                            (m) =>
                                              m.name === selectedMoped.name,
                                          );
                                        const newIndex =
                                          currentIndex === 0
                                            ? member.mopeds.length - 1
                                            : currentIndex - 1;
                                        const newMoped =
                                          member.mopeds[newIndex];
                                        if (newMoped)
                                          setSelectedMoped(newMoped);
                                      }}
                                    >
                                      <ArrowLeft className="text-white" />
                                    </Button>
                                    <Image
                                      src={selectedMoped.image}
                                      alt={selectedMoped.name}
                                      layout="fill"
                                      objectFit="contain"
                                      objectPosition="center"
                                    />
                                    <Button
                                      variant={"ghost"}
                                      className="absolute right-2 top-[50%] z-10"
                                      onClick={() => {
                                        const currentIndex =
                                          member.mopeds.findIndex(
                                            (m) =>
                                              m.name === selectedMoped.name,
                                          );
                                        const newIndex =
                                          currentIndex ===
                                          member.mopeds.length - 1
                                            ? 0
                                            : currentIndex + 1;
                                        const newMoped =
                                          member.mopeds[newIndex];
                                        if (newMoped)
                                          setSelectedMoped(newMoped);
                                      }}
                                    >
                                      <ArrowRight className="text-white" />
                                    </Button>
                                  </div>
                                </DialogHeader>
                              ) : (
                                <DialogHeader>
                                  <DialogTitle className="pb-4">
                                    {selectedMoped.name}&apos;s setup
                                  </DialogTitle>
                                  <div>
                                    {selectedMoped.setup && (
                                      <div className="grid grid-cols-2 gap-4">
                                        {Object.entries(
                                          selectedMoped.setup,
                                        ).map(([key, value]) => (
                                          <div key={key}>
                                            <h4 className="font-semibold">
                                              {key}
                                            </h4>
                                            <p>{value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </DialogHeader>
                              )}
                              <DialogFooter>
                                {selectedMoped.setup && (
                                  <Button
                                    onClick={() => {
                                      setShowSetup((prev) => !prev);
                                    }}
                                  >
                                    {showSetup ? "Back" : "Show Setup"}
                                  </Button>
                                )}
                              </DialogFooter>
                            </DialogContent>
                          )}
                        </Dialog>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
