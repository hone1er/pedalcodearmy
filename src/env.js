import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    /** Vercel Postgres connection string (used implicitly by `@vercel/postgres`). */
    POSTGRES_URL: z.string().min(1).optional(),
    /** Bearer token required for admin-only endpoints such as `GET /api/orders`. */
    ADMIN_API_KEY: z.string().min(16).optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    /** Bare Shopify hostname, e.g. `pca-moped-parts.myshopify.com` (not a URL). */
    NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: z.string().min(1).optional(),
    /** Legacy alias for `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`. */
    NEXT_PUBLIC_SHOPIFY_DOMAIN: z.string().min(1).optional(),
    /** Public Storefront API access token (never an Admin API token). */
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: z.string().min(1).optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    POSTGRES_URL: process.env.POSTGRES_URL,
    ADMIN_API_KEY: process.env.ADMIN_API_KEY,
    NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN: process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN,
    NEXT_PUBLIC_SHOPIFY_DOMAIN: process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN,
    NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN: process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
