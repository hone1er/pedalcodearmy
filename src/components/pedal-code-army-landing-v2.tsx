"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { mopeds } from "@/data/mopeds";
import {
  Bike,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Gamepad2,
  Instagram,
  MapPin,
  ShoppingBag,
  Users,
  Wrench,
  Youtube,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const EMAIL_ADDRESS = "pedalcodearmy@gmail.com";

export default function PedalCodeArmyLanding() {
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [inquiryName, setInquiryName] = useState("");
  const [inquiryType, setInquiryType] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const communityFeatures = [
    {
      href: "/stable",
      icon: Bike,
      title: "The Stable",
      description: `Browse ${mopeds.length} mopeds from our fleet. Filter by make, compare builds, and get inspired for your next project.`,
      cta: "Explore Fleet",
    },
    {
      href: "/shop",
      icon: ShoppingBag,
      title: "Speed Shop",
      description:
        "Custom 3D-printed moped parts, personalized side covers, brackets, and gang gear built by riders for riders.",
      cta: "Shop Parts",
    },
    {
      href: "/game",
      icon: Gamepad2,
      title: "Ran When Parked",
      description:
        "Diagnose real 2-stroke symptoms in the garage, dial in your tune on East Bay rides, then rip Oakland traffic in Street Runner mode.",
      cta: "Play Now",
    },
    {
      href: "/members",
      icon: Users,
      title: "The Dudes",
      description:
        "Meet the crew from Oakland to France & Germany and inspect the builds keeping the two-stroke dream alive.",
      cta: "Meet the Crew",
    },
  ];

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = inquiryName.trim();
    const trimmedMessage = inquiryMessage.trim();

    if (!trimmedName || !trimmedMessage) {
      setFormError("Please enter your name and tell us what you need.");
      return;
    }

    setFormError(null);
    const subject = inquiryType
      ? `[${inquiryType}] Inquiry from ${trimmedName}`
      : `Pedal Code Army Inquiry from ${trimmedName}`;
    const body = `Hi Pedal Code Army,\n\nI'm ${trimmedName}.\nTopic: ${inquiryType || "General Inquiry"}\n\n${trimmedMessage}`;
    const mailtoUrl = `mailto:${EMAIL_ADDRESS}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL_ADDRESS);
      setCopiedEmail(true);
      if (copyTimeoutRef.current !== null) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedEmail(false);
        copyTimeoutRef.current = null;
      }, 2500);
    } catch {
      setCopiedEmail(false);
    }
  };

  return (
    <div className="w-full text-black">
      {/* Hero Section */}
      <section className="relative flex min-h-[85vh] items-center justify-center overflow-hidden border-b-4 border-black bg-black">
        <Image
          src="/images/mili-magnum-grizzly.JPG"
          alt="Pedal Code Army moped gang cruising through the East Bay"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[0_57%] brightness-90"
        />
        <div className="relative z-10 mx-4 max-w-3xl border-4 border-black bg-black/85 p-6 text-center text-white shadow-[8px_8px_0px_0px_rgba(255,215,0,1)] sm:p-10">
          <p className="mb-3 inline-block border-2 border-black bg-[#FFD700] px-3 py-1 text-xs font-black uppercase tracking-widest text-black">
            Oakland &bull; East Bay Moped Gang
          </p>
          <h1 className="mx-auto mb-4 text-4xl font-black uppercase tracking-tight text-[#FFD700] sm:text-5xl md:text-6xl">
            Welcome to Pedal Code Army!
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg font-medium text-white sm:text-xl">
            East Bay&apos;s most entertaining moped gang — riding, wrenching,
            and printing custom parts.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="#contact"
              className="inline-block rounded-none border-4 border-black bg-[#FFD700] px-7 py-3 text-base font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.9)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-yellow-400"
            >
              Get in Touch
            </Link>
            <Link
              href="/stable"
              className="inline-block rounded-none border-4 border-[#FFD700] bg-black px-7 py-3 text-base font-black uppercase text-[#FFD700] transition-all hover:bg-[#FFD700] hover:text-black"
            >
              Browse The Stable
            </Link>
          </div>
        </div>
        <Link
          href="#about"
          aria-label="Scroll to About Our Moped Madness section"
          className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 border-2 border-black bg-[#FFD700] p-2 text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform hover:scale-105"
        >
          <ChevronDown className="h-7 w-7 animate-bounce" aria-hidden="true" />
        </Link>
      </section>

      {/* About Section */}
      <section id="about" className="border-b-4 border-black bg-white py-20 text-black">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-4xl font-black uppercase tracking-tight md:text-5xl">
            About Our Moped Madness
          </h2>
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div className="overflow-hidden border-4 border-black bg-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <Image
                src="/images/hone-derbi-grizzly.JPG"
                alt="Founder Joe with his mopeds"
                width={600}
                height={400}
                sizes="(max-width: 768px) 100vw, 50vw"
                className="h-auto w-full object-cover"
              />
            </div>
            <div className="border-4 border-black bg-[#FFD700] p-6 text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:p-8">
              <p className="mb-4 text-lg font-medium leading-relaxed">
                Born from the streets of East Bay, Pedal Code Army was started
                by Joe Villavicencio. We&apos;re a crew of skateboarders who
                also fell in love with the thrill of riding mopeds.
              </p>
              <p className="mb-4 text-lg font-medium leading-relaxed">
                Our mission? To cruise the streets, have a blast, and maybe help
                you fix that moped you impulse-bought on Craigslist at 2 AM.
              </p>
              <p className="text-lg font-bold leading-relaxed">
                Just good vibes, the sweet smell of two-stroke engines, and
                occasionally getting lost in Oakland.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Community Features Section */}
      <section className="border-b-4 border-black bg-black py-20 text-[#FFD700]">
        <div className="container mx-auto px-4">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-4xl font-black uppercase tracking-tight md:text-5xl">
              Explore the Garage
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-white/80">
              Everything you need to ride, wrench, build, and represent the crew.
            </p>
          </div>
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {communityFeatures.map((feature) => (
              <Link
                key={feature.href}
                href={feature.href}
                className="group block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FFD700]"
              >
                <div className="flex h-full flex-col justify-between rounded-none border-4 border-[#FFD700] bg-black p-6 shadow-[6px_6px_0px_0px_rgba(255,215,0,0.45)] transition-all duration-200 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[8px_8px_0px_0px_rgba(255,215,0,0.9)]">
                  <div>
                    <feature.icon
                      className="mb-4 h-11 w-11 text-[#FFD700]"
                      aria-hidden="true"
                    />
                    <h3 className="mb-2 text-2xl font-black uppercase tracking-tight text-[#FFD700]">
                      {feature.title}
                    </h3>
                    <p className="mb-6 text-white/85">{feature.description}</p>
                  </div>
                  <span className="inline-flex items-center font-black uppercase text-orange-400 group-hover:text-[#FFD700]">
                    {feature.cta}{" "}
                    <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Weekly Wobbles Section */}
      <section id="rides" className="border-b-4 border-black bg-[#FFD700] py-20 text-black">
        <div className="container mx-auto px-4">
          <h2 className="mb-12 text-center text-4xl font-black uppercase tracking-tight text-black md:text-5xl">
            Weekly Wobbles
          </h2>
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
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
            ].map((activity) => (
              <div
                key={activity.title}
                className="rounded-none border-4 border-black bg-white p-6 text-center text-gray-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center border-4 border-black bg-[#FFD700] text-black">
                  <activity.icon className="h-8 w-8" aria-hidden="true" />
                </div>
                <h3 className="mb-3 text-2xl font-black uppercase tracking-tight text-gray-900">
                  {activity.title}
                </h3>
                <p className="text-gray-700">{activity.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Join the Chaos Section */}
      <section id="contact" className="border-b-4 border-black bg-white py-20 text-black">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-xl">
            <h2 className="mb-4 text-center text-4xl font-black uppercase tracking-tight md:text-5xl">
              Join the Chaos
            </h2>
            <p className="mb-10 text-center text-lg text-gray-700">
              Need 3D printed moped parts? Looking to buy or sell a moped? Got a
              ride that needs some love? Hit us up!
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="space-y-5 border-4 border-black bg-amber-50 p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] sm:p-8"
            >
              <div>
                <label
                  htmlFor="inquiry-name"
                  className="mb-1.5 block text-sm font-black uppercase tracking-wide text-black"
                >
                  Your Name
                </label>
                <Input
                  id="inquiry-name"
                  type="text"
                  required
                  placeholder="Your Name"
                  className="w-full rounded-none border-2 border-black bg-white p-3 text-base text-black placeholder:text-gray-500"
                  value={inquiryName}
                  onChange={(e) => {
                    setInquiryName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="inquiry-type"
                  className="mb-1.5 block text-sm font-black uppercase tracking-wide text-black"
                >
                  What can we help you with?
                </label>
                <select
                  id="inquiry-type"
                  className="w-full rounded-none border-2 border-black bg-white p-3 text-base font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                  value={inquiryType}
                  onChange={(e) => setInquiryType(e.target.value)}
                >
                  <option value="">Select a topic...</option>
                  <option value="3D Printed Parts">
                    3D Printed Moped Parts
                  </option>
                  <option value="Moped Sales">Moped Sales</option>
                  <option value="Repairs">Moped Repairs</option>
                  <option value="Weekly Ride">Join a Weekly Ride</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="inquiry-message"
                  className="mb-1.5 block text-sm font-black uppercase tracking-wide text-black"
                >
                  Details
                </label>
                <Textarea
                  id="inquiry-message"
                  required
                  placeholder="Tell us more about your moped or what you need..."
                  className="w-full rounded-none border-2 border-black bg-white p-3 text-base text-black placeholder:text-gray-500"
                  rows={4}
                  value={inquiryMessage}
                  onChange={(e) => {
                    setInquiryMessage(e.target.value);
                    if (formError) setFormError(null);
                  }}
                />
              </div>

              {formError && (
                <p
                  role="alert"
                  className="border-2 border-black bg-red-100 px-3 py-2 text-sm font-bold text-red-800"
                >
                  {formError}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full rounded-none border-4 border-black bg-black py-6 text-lg font-black uppercase text-[#FFD700] shadow-[4px_4px_0px_0px_rgba(255,215,0,1)] transition-all hover:bg-gray-900"
              >
                Send Inquiry
              </Button>

              <div className="flex flex-col items-center justify-between gap-3 border-t-2 border-black/20 pt-4 sm:flex-row">
                <span className="text-sm font-bold text-gray-800">
                  No desktop mail app? Copy{" "}
                  <span className="underline">{EMAIL_ADDRESS}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyEmail()}
                  className="inline-flex items-center gap-1.5 rounded-none border-2 border-black bg-[#FFD700] px-3 py-1.5 text-xs font-black uppercase text-black transition-colors hover:bg-yellow-400"
                >
                  {copiedEmail ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy Email
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Social Section */}
      <section className="bg-[#FFD700] py-20 text-black">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-4 text-4xl font-black uppercase tracking-tight text-black md:text-5xl">
            Follow Our Misadventures
          </h2>
          <p className="mx-auto mb-12 max-w-xl text-xl font-medium text-gray-900">
            Watch us attempt stunts, get lost, and occasionally make it to our
            destination!
          </p>
          <div className="flex flex-wrap justify-center gap-8">
            <Link
              href="https://www.youtube.com/@benalbuckets"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Pedal Code Army on YouTube"
              className="flex min-w-[150px] flex-col items-center gap-2 border-4 border-black bg-white px-8 py-6 text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:bg-black hover:text-[#FFD700]"
            >
              <Youtube size={44} aria-hidden="true" />
              <span className="text-lg font-black uppercase">YouTube</span>
            </Link>
            <Link
              href="https://www.instagram.com/pedalcodearmy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Pedal Code Army on Instagram"
              className="flex min-w-[150px] flex-col items-center gap-2 border-4 border-black bg-white px-8 py-6 text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:bg-black hover:text-[#FFD700]"
            >
              <Instagram size={44} aria-hidden="true" />
              <span className="text-lg font-black uppercase">Instagram</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
