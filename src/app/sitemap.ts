import { type MetadataRoute } from "next";

const BASE_URL = "https://pedalcodearmy.com";

/**
 * Stable "last content update" date. Bump this when site content meaningfully changes
 * instead of using `new Date()`, which would report every page as modified on every request.
 */
const LAST_MODIFIED = new Date("2026-11-24T00:00:00.000Z");

type SitemapEntry = MetadataRoute.Sitemap[number];

const ROUTES: Array<{
  path: string;
  changeFrequency: SitemapEntry["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/shop", changeFrequency: "weekly", priority: 0.9 },
  { path: "/shop/side-covers", changeFrequency: "weekly", priority: 0.8 },
  { path: "/stable", changeFrequency: "monthly", priority: 0.8 },
  { path: "/members", changeFrequency: "monthly", priority: 0.6 },
  { path: "/game", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? BASE_URL : `${BASE_URL}${path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency,
    priority,
  }));
}
