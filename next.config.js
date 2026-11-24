/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopifycdn.com" },
      { protocol: "https", hostname: "shop.pedalcodearmy.com" },
      { protocol: "https", hostname: "pca-moped-parts.myshopify.com" },
    ],
  },
};

export default config;
