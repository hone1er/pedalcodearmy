import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Build Calculator",
  robots: {
    index: false,
    follow: false,
  },
};

// Hidden for now; BuildCalculator component and build-recipes data are preserved in src/.
export default function BuildCalculatorPage() {
  notFound();
}
