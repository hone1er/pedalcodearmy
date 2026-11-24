import { permanentRedirect } from "next/navigation";

export default function RanWhenParkedRedirectPage() {
  permanentRedirect("/game");
}
