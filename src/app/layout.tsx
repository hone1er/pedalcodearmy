import { Button } from "@/components/ui/button";
import "@/styles/globals.css";
import { BikeIcon as Motorcycle } from "lucide-react";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pedal Code Army",
  description:
    "A website for the Pedal Code Army moped gang. An East Bay moped gang that rides together, skates together, and wrenches together. Come join the madness!",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body>
        <div className="min-h-screen scroll-smooth bg-[#FFD700] font-sans">
          <header className="sticky top-0 z-50 bg-black py-4 text-[#FFD700]">
            <div className="container mx-auto flex items-center justify-between px-4">
              <Link href={"/"} className="flex items-center space-x-2">
                <Motorcycle className="h-8 w-8" />
                <span className="text-2xl font-bold">Pedal Code Army</span>
              </Link>
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
                  <li>
                    <a href="/members" className="hover:underline">
                      The Dudes
                    </a>
                  </li>
                </ul>
              </nav>
              <nav className="md:hidden">
                <Button
                  size="lg"
                  className="bg-[#FFD700] text-black hover:bg-[#FFB700]"
                >
                  Menu
                </Button>
                <div className="absolute left-0 top-0 flex h-full w-full flex-col items-center justify-center space-y-4 bg-black bg-opacity-90">
                  <a href="#about" className="hover:underline">
                    About Our Madness
                  </a>
                  <a href="#rides" className="hover:underline">
                    Wobbly Rides
                  </a>
                  <a href="#join" className="hover:underline">
                    Join the Chaos
                  </a>
                  <a href="/members" className="hover:underline">
                    The Dudes
                  </a>
                </div>
              </nav>
            </div>
          </header>
          {children}
        </div>
        <footer className="bg-black py-12 text-[#FFD700]">
          <div className="container mx-auto px-4 text-center">
            <p className="mb-4">
              &copy; {new Date().getFullYear()} Pedal Code Army. No rights
              reserved. Seriously, we don&apos;t even know what that means.
            </p>
            <p className="mb-4">
              Proudly puttering around the streets of East Bay since...
              recently.
            </p>
            <p>Founded by Kyle and Joe. Blame them for this madness.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
