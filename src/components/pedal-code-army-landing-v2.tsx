import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BikeIcon as Motorcycle,
  Wrench,
  MapPin,
  Calendar,
  Youtube,
  Instagram,
  ChevronDown,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function PedalCodeArmyLanding() {
  return (
    <div className="min-h-screen bg-[#FFD700] font-sans">
      <header className="sticky top-0 z-50 bg-black py-4 text-[#FFD700]">
        <div className="container mx-auto flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <Motorcycle className="h-8 w-8" />
            <span className="text-2xl font-bold">Pedal Code Army</span>
          </div>
          <nav className="hidden md:block">
            <ul className="flex space-x-6">
              <li>
                <a href="#about" className="hover:underline">
                  About Our Madness
                </a>
              </li>
              <li>
                <a href="#rides" className="hover:underline">
                  Wobbly Rides
                </a>
              </li>
              <li>
                <a href="#join" className="hover:underline">
                  Join the Chaos
                </a>
              </li>
            </ul>
          </nav>
          <Button className="md:hidden">Menu</Button>
        </div>
      </header>

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
            <Button
              size="lg"
              className="bg-[#FFD700] text-black hover:bg-[#FFB700]"
            >
              Join the Madness
            </Button>
          </div>
          <ChevronDown className="absolute bottom-8 left-1/2 h-12 w-12 -translate-x-1/2 transform animate-bounce text-white" />
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
                  Born from the wild streets of East Bay, Pedal Code Army was
                  started by Kyle Militante and Joe Villavicencio. We&apos;re a
                  crew of skateboarders who also fell in love with the thrill of
                  riding mopeds.
                </p>
                <p className="mb-4 text-lg">
                  Our mission? To cruise the streets, have a blast, and maybe
                  help you fix that moped you impulse-bought on Craigslist at 2
                  AM.
                </p>
                <p className="text-lg">
                  Just good vibes, the sweet smell of two-stroke engines, and
                  occasionally getting lost in Oakland.
                </p>
              </div>
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

        <section id="join" className="bg-white py-20 text-black">
          <div className="container mx-auto px-4">
            <h2 className="mb-8 text-center text-4xl font-bold">
              Join the Pedal Code Army
            </h2>
            <p className="mb-12 text-center text-xl">
              Think you&apos;ve got what it takes to be a moped miscreant? Apply
              now!
            </p>
            <form className="mx-auto max-w-md space-y-6">
              <Input
                type="text"
                placeholder="Your Name (or cool moped nickname)"
                className="w-full p-3 text-lg"
              />
              <Input
                type="email"
                placeholder="Your Email (we promise not to spam... much)"
                className="w-full p-3 text-lg"
              />
              <Textarea
                placeholder="Tell us about your moped (or the one you're eyeing on Craigslist)"
                className="w-full p-3 text-lg"
                rows={4}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full bg-black text-lg text-[#FFD700] hover:bg-gray-800"
              >
                Submit Application
              </Button>
            </form>
          </div>
        </section>

        <section className="bg-[#FFD700] py-20">
          <div className="container mx-auto px-4 text-center">
            <h2 className="mb-8 text-4xl font-bold">
              Follow Our Misadventures
            </h2>
            <p className="mb-12 text-xl">
              Watch us attempt stunts, get lost, and occasionally make it to our
              destination!
            </p>
            <div className="flex justify-center space-x-12">
              <Link
                href="https://www.youtube.com/benalbuckets"
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

      <footer className="bg-black py-12 text-[#FFD700]">
        <div className="container mx-auto px-4 text-center">
          <p className="mb-4">
            &copy; {new Date().getFullYear()} Pedal Code Army. No rights
            reserved. Seriously, we don&apos;t even know what that means.
          </p>
          <p className="mb-4">
            Proudly puttering around the streets of East Bay since... recently.
          </p>
          <p>Founded by Kyle and Joe. Blame them for this madness.</p>
          <div className="mt-8 flex justify-center space-x-4">
            <Link href="#" className="text-[#FFD700] hover:text-white">
              Privacy Policy
            </Link>
            <Link href="#" className="text-[#FFD700] hover:text-white">
              Terms of Service
            </Link>
            <Link href="#" className="text-[#FFD700] hover:text-white">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
