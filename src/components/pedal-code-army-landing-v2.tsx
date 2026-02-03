"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Wrench,
  MapPin,
  Calendar,
  Youtube,
  Instagram,
  ChevronDown,
  Bike,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function PedalCodeArmyLanding() {
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryType, setInquiryType] = useState("");

  return (
    <main>
      <section className="relative flex h-screen items-center justify-center overflow-hidden">
        <Image
          src="/images/mili-magnum-grizzly.JPG"
          alt="Moped gang cruising through East Bay"
          layout="fill"
          objectPosition="0 57%"
          objectFit="cover"
          className="absolute z-0 brightness-[1.2]"
        />
        <div className="relative z-10 w-full max-w-full rounded-lg bg-black bg-opacity-50 p-8 text-center text-white">
          <h1 className="mx-auto mb-4 max-w-96 text-pretty text-5xl font-bold md:max-w-full">
            Welcome to Pedal Code Army!
          </h1>
          <p className="mb-6 text-xl">
            East Bay&apos;s most entertaining moped gang
          </p>
          <Link href="#contact">
            <Button
              size="lg"
              className="bg-[#FFD700] text-black hover:bg-[#FFB700]"
            >
              Get in Touch
            </Button>
          </Link>
        </div>
        <Link href={"#about"}>
          <ChevronDown className="absolute bottom-8 left-1/2 h-12 w-12 -translate-x-1/2 transform animate-bounce text-white" />
        </Link>
      </section>

      <section id="about" className="bg-white py-20 text-black">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-4xl font-bold">
            About Our Moped Madness
          </h2>
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <Image
                src="/images/hone-derbi-grizzly.JPG"
                alt="Founders Kyle and Joe with their mopeds"
                width={600}
                height={400}
                className="rounded-lg shadow-lg"
              />
            </div>
            <div>
              <p className="mb-4 text-lg">
                Born from the streets of East Bay, Pedal Code Army was started
                by Kyle Militante and Joe Villavicencio. We&apos;re a crew of
                skateboarders who also fell in love with the thrill of riding
                mopeds.
              </p>
              <p className="mb-4 text-lg">
                Our mission? To cruise the streets, have a blast, and maybe help
                you fix that moped you impulse-bought on Craigslist at 2 AM.
              </p>
              <p className="text-lg">
                Just good vibes, the sweet smell of two-stroke engines, and
                occasionally getting lost in Oakland.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Features Section */}
      <section className="bg-black py-20 text-[#FFD700]">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-4xl font-bold">
            Community Tools
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-white/70">
            Resources built by moped nerds, for moped nerds. Browse builds,
            troubleshoot problems, and plan your next project.
          </p>
          <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
            {/* The Stable */}
            <Link href="/stable" className="group">
              <div className="h-full transform rounded-none border-4 border-[#FFD700] bg-black p-6 shadow-[4px_4px_0px_0px_rgba(255,215,0,0.3)] transition-all duration-300 hover:shadow-[6px_6px_0px_0px_rgba(255,215,0,0.5)]">
                <Bike className="mb-4 h-12 w-12 text-[#FFD700]" />
                <h3 className="mb-2 text-2xl font-black uppercase tracking-tight">
                  The Stable
                </h3>
                <p className="mb-4 text-white/70">
                  Browse 27+ mopeds from our fleet. Filter by make, compare
                  builds, and get inspired for your next project.
                </p>
                <span className="flex items-center font-bold text-orange-500 group-hover:text-orange-400">
                  Explore Fleet <ChevronRight className="ml-1 h-4 w-4" />
                </span>
              </div>
            </Link>

            {/* Wrench Roulette */}
            <Link href="/wrench-roulette" className="group">
              <div className="h-full transform rounded-none border-4 border-[#FFD700] bg-black p-6 shadow-[4px_4px_0px_0px_rgba(255,215,0,0.3)] transition-all duration-300 hover:shadow-[6px_6px_0px_0px_rgba(255,215,0,0.5)]">
                <Wrench className="mb-4 h-12 w-12 text-[#FFD700]" />
                <h3 className="mb-2 text-2xl font-black uppercase tracking-tight">
                  Wrench Roulette
                </h3>
                <p className="mb-4 text-white/70">
                  Moped acting up? Click through our troubleshooting flowchart
                  to diagnose common problems and get fix suggestions.
                </p>
                <span className="flex items-center font-bold text-orange-500 group-hover:text-orange-400">
                  Diagnose Now <ChevronRight className="ml-1 h-4 w-4" />
                </span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section id="rides" className="bg-[#FFD700] py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-4xl font-bold">
            Weekly Wobbles
          </h2>
          <div className="mb-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Calendar,
                title: "Moped Mondays",
                description:
                  "Every Monday at some time in the evening at some place in the East Bay. Where we go? Nobody knows. Or maybe you know! BYO Moped (Borrowing is cool too)",
              },
              {
                icon: Wrench,
                title: "Tinkerer's Paradise",
                description:
                  "We'll help you fix that rattling noise. 60% of the time, it works every time! You gotta supply the parts though and maybe some beer. Let's get you rolling!",
              },
              {
                icon: MapPin,
                title: "East Bay Explorer",
                description:
                  "Discover hidden gems and the best taco trucks. Getting lost is half the fun! Which is good because we get lost a lot.",
              },
            ].map((activity, index) => (
              <div
                key={index}
                className="transform rounded-lg bg-white p-6 text-center shadow-md transition duration-500 hover:scale-105"
              >
                <activity.icon className="mx-auto mb-4 h-16 w-16 text-[#FFD700]" />
                <h3 className="mb-2 text-2xl font-semibold">
                  {activity.title}
                </h3>
                <p className="text-gray-600">{activity.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Button
              size="lg"
              className="bg-black text-[#FFD700] hover:bg-gray-800"
            >
              View Ride Calendar
            </Button>
          </div>
        </div>
      </section>

      <section id="contact" className="bg-white py-20 text-black">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-center text-4xl font-bold">Contact Us</h2>
          <p className="mb-12 text-center text-xl">
            Need 3D printed moped parts? Looking to buy or sell a moped? Got a
            ride that needs some love? Hit us up!
          </p>
          <form className="mx-auto max-w-md space-y-6">
            <Input
              type="text"
              placeholder="Your Name"
              className="w-full p-3 text-lg"
              value={inquiryName}
              onChange={(e) => setInquiryName(e.target.value)}
            />
            <select
              className="w-full rounded-md border border-gray-300 p-3 text-lg"
              value={inquiryType}
              onChange={(e) => setInquiryType(e.target.value)}
            >
              <option value="">What can we help you with?</option>
              <option value="3D Printed Parts">3D Printed Moped Parts</option>
              <option value="Moped Sales">Moped Sales</option>
              <option value="Repairs">Moped Repairs</option>
              <option value="Other">Other</option>
            </select>
            <Textarea
              placeholder="Tell us more about what you need..."
              className="w-full p-3 text-lg"
              rows={4}
              value={inquiryMessage}
              onChange={(e) => setInquiryMessage(e.target.value)}
            />
            <Link
              href={`mailto:pedalcodearmy@gmail.com?subject=${encodeURIComponent(inquiryType || "Inquiry")}&body=${encodeURIComponent(`Hi, I'm ${inquiryName}.\n\n${inquiryMessage}`)}`}
            >
              <Button
                size="lg"
                className="mt-4 w-full bg-black text-lg text-[#FFD700] hover:bg-gray-800"
              >
                Send Inquiry
              </Button>
            </Link>
          </form>
        </div>
      </section>

      <section className="bg-[#FFD700] py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-8 text-4xl font-bold">Follow Our Misadventures</h2>
          <p className="mb-12 text-xl">
            Watch us attempt stunts, get lost, and occasionally make it to our
            destination!
          </p>
          <div className="flex justify-center space-x-12">
            <Link
              href="https://www.youtube.com/@benalbuckets"
              className="flex transform flex-col items-center space-y-2 text-black transition duration-500 hover:scale-110 hover:text-gray-800"
            >
              <Youtube size={48} />
              <span className="text-lg">YouTube</span>
            </Link>
            <Link
              href="https://www.instagram.com/pedalcodearmy"
              className="flex transform flex-col items-center space-y-2 text-black transition duration-500 hover:scale-110 hover:text-gray-800"
            >
              <Instagram size={48} />
              <span className="text-lg">Instagram</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
