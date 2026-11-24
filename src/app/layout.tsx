import "@/styles/globals.css";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import Link from "next/link";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

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

const FOOTER_LINKS = [
  { href: "/stable", label: "The Stable" },
  { href: "/shop", label: "Shop" },
  { href: "/members", label: "The Dudes" },
  { href: "/game", label: "Arcade" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable}`}>
      <body className="bg-[#FFD700] font-sans text-black antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col bg-[#FFD700]">
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <footer className="border-t-4 border-[#FFD700] bg-black py-12 text-[#FFD700]">
              <div className="container mx-auto px-4 text-center">
                <nav
                  aria-label="Footer navigation"
                  className="mb-8 flex flex-wrap justify-center gap-x-6 gap-y-2"
                >
                  {FOOTER_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-sm font-black uppercase tracking-wide text-[#FFD700] underline-offset-4 hover:text-white hover:underline"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <p className="mb-3">
                  &copy; {new Date().getFullYear()} Pedal Code Army. No rights
                  reserved. Seriously, we don&apos;t even know what that means.
                </p>
                <p className="mb-3">
                  Proudly puttering around the streets of East Bay since...
                  recently.
                </p>
                <p className="mb-4">
                  Founded by Joe. Blame him for this madness.
                </p>

                <p className="mb-6">
                  <a
                    href="tel:+15103897975"
                    className="font-bold text-[#FFD700] hover:text-white hover:underline"
                  >
                    (510) 389-7975
                  </a>
                </p>

                <div className="mx-auto max-w-2xl border-t border-[#FFD700]/30 pt-6 text-xs text-[#FFD700]/80">
                  <p className="mb-2 font-bold uppercase tracking-wide text-[#FFD700]">
                    Legal Disclaimer
                  </p>
                  <p>
                    All products sold by Pedal Code Army, including 3D printed
                    parts, are provided &quot;as is&quot; without warranty of
                    any kind. Use at your own risk. Not responsible for injury,
                    death, property damage, or mechanical failure. Parts are not
                    safety tested or certified. For off-road and novelty use
                    only. Professional installation recommended. By purchasing,
                    you assume all risks and liabilities.
                  </p>
                </div>
              </div>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
