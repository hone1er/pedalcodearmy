/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

const isDev = process.env.NODE_ENV !== "production";

const SHOPIFY_SOURCES = [
  "https://*.myshopify.com",
  "https://*.shopify.com",
  "https://cdn.shopify.com",
  "https://*.shopifycdn.com",
  "https://shop.pedalcodearmy.com",
];

/**
 * Content-Security-Policy tuned for:
 * - Next.js App Router (inline bootstrap scripts, inline styles, JSON-LD `<script>` tags;
 *   `'unsafe-eval'` only for dev tooling / React Refresh)
 * - Shopify Storefront API, checkout links, CDN images/videos/3D models
 * - Google Fonts
 * - three.js / WebGL GLB loading via `blob:` and `data:` URLs
 * - Instagram / YouTube / Vimeo reel embeds in the product carousel
 */
const cspDirectives = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "object-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'", ...SHOPIFY_SOURCES],
  "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
  "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
  "img-src": ["'self'", "data:", "blob:", ...SHOPIFY_SOURCES],
  "media-src": ["'self'", "data:", "blob:", ...SHOPIFY_SOURCES],
  "connect-src": [
    "'self'",
    "data:",
    "blob:",
    ...SHOPIFY_SOURCES,
    ...(isDev ? ["ws:", "wss:"] : []),
  ],
  "worker-src": ["'self'", "blob:"],
  "frame-src": [
    "'self'",
    "https://www.instagram.com",
    "https://*.instagram.com",
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
    "https://player.vimeo.com",
    ...SHOPIFY_SOURCES,
  ],
  "manifest-src": ["'self'"],
};

const contentSecurityPolicy = Object.entries(cspDirectives)
  .map(([directive, sources]) =>
    sources.length > 0 ? `${directive} ${sources.join(" ")}` : directive,
  )
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/** @type {import("next").NextConfig} */
const config = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopifycdn.com" },
      { protocol: "https", hostname: "shop.pedalcodearmy.com" },
      { protocol: "https", hostname: "pca-moped-parts.myshopify.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default config;
