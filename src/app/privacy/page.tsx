import { type Metadata } from "next";
import Link from "next/link";

const CONTACT_EMAIL = "pedalcodearmy@gmail.com";
const LAST_UPDATED = "November 24, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Pedal Code Army handles cookies, cart storage, waitlist and custom orders, and City Runner leaderboard names. No ad tracking, no data selling.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy | Pedal Code Army",
    description:
      "Cookies, cart storage, orders and leaderboard data at Pedal Code Army. No ad tracking, no data selling.",
    url: "https://pedalcodearmy.com/privacy",
    siteName: "Pedal Code Army",
    type: "website",
  },
};

type StorageItem = {
  name: string;
  where: string;
  purpose: string;
  lifetime: string;
};

const STORAGE_ITEMS: StorageItem[] = [
  {
    name: "pca-cookie-consent",
    where: "Cookie + local storage",
    purpose: "Remembers whether you accepted or declined the cookie notice.",
    lifetime: "1 year",
  },
  {
    name: "pca-shopify-cart-id",
    where: "Cookie if you accept cookies; session storage if you decline",
    purpose:
      "Links your cart to our Shopify store so checkout picks up where you left off. Only the cart ID is stored — never its contents.",
    lifetime:
      "10 days (cookie, refreshed when your cart updates); until you close the tab (session storage)",
  },
  {
    name: "pca-cart",
    where:
      "Browser web storage only (local storage if you accept, session storage if you decline) — never a cookie",
    purpose:
      "Keeps your cart items when the Shopify store isn't connected, so the cart survives page reloads.",
    lifetime:
      "Until you empty your cart or clear site data (local storage); until you close the tab (session storage)",
  },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="border-4 border-black bg-white p-6 text-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-8"
    >
      <h2
        id={`${id}-heading`}
        className="mb-4 inline-block bg-black px-3 py-1 text-xl font-black uppercase tracking-tight text-[#FFD700] md:text-2xl"
      >
        {title}
      </h2>
      <div className="space-y-3 text-base leading-relaxed text-gray-900">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[#FFD700] pb-16 focus:outline-none"
    >
      <header className="border-b-4 border-black bg-black text-[#FFD700]">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <p className="mb-3 inline-block border-2 border-[#FFD700] px-2 py-0.5 text-xs font-black uppercase tracking-widest">
            The fine print
          </p>
          <h1 className="text-4xl font-black uppercase leading-none tracking-tight md:text-6xl">
            Privacy &amp; Cookie Policy
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#FFD700]/90">
            We&apos;re a moped gang, not an ad network. Here&apos;s exactly what we store, why,
            and how to get rid of it.
          </p>
          <p className="mt-4 text-sm font-bold uppercase tracking-wide text-white/70">
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </header>

      <div className="container mx-auto max-w-4xl space-y-8 px-4 pt-10">
        <Section id="short-version" title="The Short Version">
          <ul className="list-disc space-y-2 pl-5 font-semibold">
            <li>No advertising trackers, no third-party analytics pixels, no data selling. Ever.</li>
            <li>Cookies and local storage are used only to run the site: your cart and your cookie choice.</li>
            <li>
              If you join a waitlist or request a custom order, we keep your name, email and order
              details so we can follow up.
            </li>
            <li>City Runner leaderboard entries show the display name you choose — nothing else about you.</li>
            <li>
              Questions or deletion requests:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline decoration-2 underline-offset-2">
                {CONTACT_EMAIL}
              </a>
            </li>
          </ul>
        </Section>

        <Section id="cookies" title="Cookies & Local Storage">
          <p>
            We only use first-party, strictly functional storage. Nothing here is used to track you
            across other websites.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-2 border-black text-left text-sm">
              <thead className="bg-black text-[#FFD700]">
                <tr>
                  <th scope="col" className="border-2 border-black px-3 py-2 font-black uppercase">
                    Name
                  </th>
                  <th scope="col" className="border-2 border-black px-3 py-2 font-black uppercase">
                    Where
                  </th>
                  <th scope="col" className="border-2 border-black px-3 py-2 font-black uppercase">
                    Purpose
                  </th>
                  <th scope="col" className="border-2 border-black px-3 py-2 font-black uppercase">
                    Lifetime
                  </th>
                </tr>
              </thead>
              <tbody>
                {STORAGE_ITEMS.map((item) => (
                  <tr key={item.name} className="odd:bg-white even:bg-[#FFF6BF]">
                    <td className="border-2 border-black px-3 py-2 font-mono text-xs font-bold">
                      {item.name}
                    </td>
                    <td className="border-2 border-black px-3 py-2">{item.where}</td>
                    <td className="border-2 border-black px-3 py-2">{item.purpose}</td>
                    <td className="border-2 border-black px-3 py-2">{item.lifetime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            You can clear these at any time from your browser settings. Clearing them empties your
            cart and brings back the cookie notice — nothing else breaks.
          </p>
        </Section>

        <Section id="shop" title="Shop & Checkout">
          <p>
            Our parts store runs on Shopify. When you add items to your cart, your browser talks to
            Shopify&apos;s Storefront API to create and update the cart. When you check out, you
            complete payment on Shopify&apos;s secure checkout — we never see or store your card
            details.
          </p>
          <p>
            Information you provide at checkout (shipping address, payment, email) is handled by
            Shopify under{" "}
            <a
              href="https://www.shopify.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-2 underline-offset-2"
            >
              Shopify&apos;s privacy policy
            </a>
            . We receive the order details needed to pack and ship your parts.
          </p>
        </Section>

        <Section id="orders" title="Waitlist & Custom Orders">
          <p>
            When you join a waitlist or request a custom side cover, we store what you send us: your
            name, email address, the product, quantity, any custom text, font and styling choices,
            an estimated price and any notes you add.
          </p>
          <p>
            We use this only to contact you about that order. We don&apos;t add you to a marketing
            list, and we don&apos;t share it with anyone except the services we use to host the
            site and database.
          </p>
        </Section>

        <Section id="leaderboard" title="City Runner Leaderboard">
          <p>
            If you submit a City Runner score, we store the display name you type, your moped
            choice, score, distance and parts collected. This is shown publicly on the leaderboard,
            so please don&apos;t use your real full name or anything personal.
          </p>
          <p>Want an entry removed? Email us with the name and score and we&apos;ll scrub it.</p>
        </Section>

        <Section id="security" title="Security & Abuse Prevention">
          <p>
            To prevent spam and abuse, our servers briefly look at the IP address of requests that
            submit orders or scores and apply rate limits. These counters live in memory for about ten
            minutes and are not stored in our database or used to identify you.
          </p>
          <p>
            Like any website, our hosting provider may keep standard server logs (such as IP address
            and browser type) for a short time to keep the site running and secure.
          </p>
        </Section>

        <Section id="tracking" title="Zero Ad Tracking">
          <p>
            We don&apos;t run ad networks, retargeting pixels, social media trackers or
            cross-site analytics. We don&apos;t sell, rent or trade your information. Links to
            Instagram, YouTube or other sites take you to services with their own policies.
          </p>
        </Section>

        <Section id="rights" title="Your Choices & Rights">
          <p>
            You can ask us to see, correct or delete the information we hold about you (waitlist and
            custom-order details, or leaderboard entries). Depending on where you live — for
            example California (CCPA/CPRA) or the EU/UK (GDPR) — you may have additional rights,
            and we&apos;ll honor them.
          </p>
          <p>
            This site isn&apos;t directed at children under 13, and we don&apos;t knowingly collect
            their personal information.
          </p>
        </Section>

        <Section id="contact" title="Contact">
          <p>
            Questions, requests, or just want to talk two-strokes? Email{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-black underline decoration-2 underline-offset-2"
            >
              {CONTACT_EMAIL}
            </a>
            . If we change this policy, we&apos;ll update the date at the top of this page.
          </p>
        </Section>

        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href="/"
            className="border-4 border-black bg-black px-6 py-3 font-black uppercase text-[#FFD700] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Back Home
          </Link>
          <Link
            href="/shop"
            className="border-4 border-black bg-white px-6 py-3 font-black uppercase text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-black"
          >
            Shop Parts
          </Link>
        </div>
      </div>
    </main>
  );
}
