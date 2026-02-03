import "@/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: {
    default: "Pedal Code Army",
    template: "%s | Pedal Code Army",
  },
  description:
    "A website for the Pedal Code Army moped gang. An East Bay moped gang that rides together, skates together, and wrenches together. Come join the madness!",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  metadataBase: new URL("https://pedalcodearmy.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Pedal Code Army",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&family=Anton&family=Bangers&family=Bebas+Neue&family=Black+Ops+One&family=Bungee&family=Lobster&family=Montserrat:wght@700&family=Orbitron:wght@700&family=Oswald:wght@700&family=Pacifico&family=Permanent+Marker&family=Racing+Sans+One&family=Righteous&family=Roboto+Condensed:wght@700&family=Russo+One&family=Teko:wght@600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen scroll-smooth bg-[#FFD700] font-sans">
          <header className="sticky top-0 z-30 bg-black py-4 text-[#FFD700]">
            <div className="container mx-auto flex items-center justify-between px-4">
              <Link href={"/"} className="flex items-center space-x-2">
                <Image
                  src="/images/pedalcode.jpeg"
                  alt="pedal code logo"
                  className="h-8 w-8 rounded-full"
                  width={32}
                  height={32}
                />
                <span className="text-2xl font-bold">Pedal Code Army</span>
              </Link>
              <nav className="block">
                <ul className="flex space-x-6">
                  <li>
                    <Link href="/stable" className="hover:underline">
                      The Stable
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/wrench-roulette"
                      className="hidden hover:underline md:block"
                    >
                      Wrench Roulette
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/build-calculator"
                      className="hidden hover:underline lg:block"
                    >
                      Build Calculator
                    </Link>
                  </li>
                  <li>
                    <Link href="/shop" className="hover:underline">
                      Shop
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/members"
                      className="hidden hover:underline md:block"
                    >
                      The Dudes
                    </Link>
                  </li>
                </ul>
              </nav>
              {/* <nav className="md:hidden">
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
              </nav> */}
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
            <p className="mb-6">Founded by Kyle and Joe. Blame them for this madness.</p>

            <div className="mx-auto max-w-2xl border-t border-yellow-700 pt-6 text-xs text-yellow-600">
              <p className="mb-2 font-bold uppercase tracking-wide">Legal Disclaimer</p>
              <p>
                All products sold by Pedal Code Army, including 3D printed parts, are provided &quot;as is&quot; without warranty of any kind.
                Use at your own risk. Not responsible for injury, death, property damage, or mechanical failure.
                Parts are not safety tested or certified. For off-road and novelty use only.
                Professional installation recommended. By purchasing, you assume all risks and liabilities.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
