import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BikeIcon as Motorcycle, Instagram, Youtube } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// This would typically come from a database or API
const members = [
  {
    name: "Joe Villavicencio",
    bio: "Founder, moped whisperer, and designated 'are we lost?' guy",
    mopeds: [
      {
        name: "Hobbit",
        image: "/images/honesMopeds/hobbit.JPG",
      },
      {
        name: "Maxi N",
        image: "/images/honesMopeds/maxi_n.JPG",
      },
      {
        name: "Maxi",
        image: "/images/honesMopeds/maxi.JPG",
      },
      {
        name: "Magnum",
        image: "/images/honesMopeds/magnum.JPG",
      },
      {
        name: "Derbi",
        image: "/images/honesMopeds/derbi.JPG",
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
        image: "/images/milisMopeds/magnum.jpeg",
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
                        <div className="relative pb-[75%]">
                          <Image
                            src={moped.image}
                            alt={moped.name}
                            layout="fill"
                            objectFit="contain"
                            objectPosition="center"
                          />
                        </div>
                        <div className="p-2">
                          <p className="text-center font-semibold">
                            {moped.name}
                          </p>
                        </div>
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
