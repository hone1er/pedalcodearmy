import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Troubleshooter",
  robots: {
    index: false,
    follow: false,
  },
};

// Hidden for now; Troubleshooter component and troubleshooting data are preserved in src/.
export default function TroubleshooterPage() {
  notFound();
}
