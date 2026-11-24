// Shopify configuration
const SHOPIFY_DOMAIN = (process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? "pca-moped-parts.myshopify.com").trim();
const RAW_STOREFRONT_TOKEN = (process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? "").trim();
// Never forward Shopify OAuth client secrets or Admin API tokens as Storefront access tokens.
const NON_STOREFRONT_TOKEN_PREFIXES = ["shpss_", "shpat_", "shpca_"];
const STOREFRONT_ACCESS_TOKEN = NON_STOREFRONT_TOKEN_PREFIXES.some((prefix) =>
  RAW_STOREFRONT_TOKEN.toLowerCase().startsWith(prefix),
)
  ? ""
  : RAW_STOREFRONT_TOKEN;

let tokenRejected = false;

// Map product IDs to Shopify variant IDs (GraphQL global IDs)
export const SHOPIFY_VARIANT_IDS: Record<string, string> = {
  "fork-spacers": "gid://shopify/ProductVariant/42530734080098",
  "chain-tensioner": "gid://shopify/ProductVariant/42530733424738",
  "headlight-bracket-pa50": "gid://shopify/ProductVariant/42629262442594",
};

export function getShopifyVariantId(productId: string): string | null {
  return SHOPIFY_VARIANT_IDS[productId] ?? null;
}

// Create a permalink checkout URL (fallback method)
export function createCheckoutUrl(items: { variantId: string; quantity: number }[]): string {
  const cartItems = items
    .map((item) => `${extractNumericVariantId(item.variantId)}:${item.quantity}`)
    .join(",");
  return `https://${SHOPIFY_DOMAIN}/cart/${cartItems}`;
}

const STOREFRONT_TIMEOUT_MS = 8000;

/**
 * Thrown when Shopify accepts the request but rejects the operation itself
 * (cart mutation `userErrors`: sold out, invalid variant, missing cart, ...).
 * Callers should surface these to the user rather than retrying or falling back.
 */
export class ShopifyUserError extends Error {
  readonly code?: string;
  readonly field?: string[];

  constructor(message: string, options?: { code?: string | null; field?: string[] | null }) {
    super(message);
    this.name = "ShopifyUserError";
    this.code = options?.code ?? undefined;
    this.field = options?.field ?? undefined;
  }

  /**
   * Shopify reports that the referenced cart no longer exists (expired or
   * completed). Observed shape for line mutations on a dead cart:
   * `userErrors: [{ field: ["cartId"], code: "INVALID", message: "The specified cart does not exist." }]`.
   */
  get isCartNotFound(): boolean {
    if (this.code === "CART_NOT_FOUND") return true;
    const lastField = this.field?.[this.field.length - 1];
    return lastField === "cartId";
  }
}

/**
 * Thrown for transport-level failures: network errors, timeouts, non-2xx HTTP
 * responses, or top-level GraphQL errors. `kind === "graphql"` means Shopify
 * answered but rejected the query (e.g. a malformed ID); the others mean
 * Shopify could not be reached reliably and the operation may be retried.
 */
export class ShopifyRequestError extends Error {
  readonly kind: "network" | "http" | "graphql";
  readonly status?: number;
  /** Raw top-level GraphQL errors, when `kind === "graphql"`. */
  readonly graphqlErrors?: ReadonlyArray<StorefrontGraphQLError>;

  constructor(
    message: string,
    kind: "network" | "http" | "graphql",
    options?: { status?: number; graphqlErrors?: ReadonlyArray<StorefrontGraphQLError> },
  ) {
    super(message);
    this.name = "ShopifyRequestError";
    this.kind = kind;
    this.status = options?.status;
    this.graphqlErrors = options?.graphqlErrors;
  }

  /**
   * True when Shopify rejected an ID variable as malformed, e.g.
   * `Variable $cartId of type ID! was provided invalid value` /
   * `Invalid global id 'garbage'`.
   */
  get isInvalidIdError(): boolean {
    if (this.kind !== "graphql" || !this.graphqlErrors) return false;
    return this.graphqlErrors.some((err) => {
      const problems = err.extensions?.problems ?? [];
      return (
        /invalid global id/i.test(err.message) ||
        problems.some((problem) => /invalid global id/i.test(problem.explanation ?? problem.message ?? ""))
      );
    });
  }
}

/** True when an error means Shopify could not be reached (safe to retry later). */
export function isShopifyNetworkError(error: unknown): boolean {
  return error instanceof ShopifyRequestError && error.kind !== "graphql";
}

interface StorefrontGraphQLError {
  message: string;
  extensions?: {
    code?: string;
    problems?: Array<{ explanation?: string; message?: string }>;
  };
}

// Storefront API response type
interface StorefrontResponse<T> {
  data?: T;
  errors?: StorefrontGraphQLError[];
}

interface StorefrontFetchOptions {
  revalidate?: number;
}

function buildStorefrontRequest(
  query: string,
  variables: Record<string, unknown> | undefined,
  options: StorefrontFetchOptions | undefined,
  token: string,
): RequestInit & { next?: { revalidate: number } } {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["X-Shopify-Storefront-Access-Token"] = token;
  }

  const fetchInit: RequestInit & { next?: { revalidate: number } } = {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  };

  // A fresh signal per request so the tokenless retry gets its own full timeout.
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    fetchInit.signal = AbortSignal.timeout(STOREFRONT_TIMEOUT_MS);
  }

  if (typeof window === "undefined" && options?.revalidate !== undefined) {
    fetchInit.next = { revalidate: options.revalidate };
  }

  return fetchInit;
}

async function fetchOrThrow(endpoint: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(endpoint, init);
  } catch (error) {
    const isTimeout =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ShopifyRequestError(
      isTimeout ? "Shopify request timed out" : "Could not reach Shopify",
      "network",
    );
  }
}

// Storefront API client
async function storefrontFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: StorefrontFetchOptions,
): Promise<T> {
  const endpoint = `https://${SHOPIFY_DOMAIN}/api/2025-01/graphql.json`;
  const token = tokenRejected ? "" : STOREFRONT_ACCESS_TOKEN;

  let response = await fetchOrThrow(
    endpoint,
    buildStorefrontRequest(query, variables, options, token),
  );

  // Fall back to Shopify's Tokenless Storefront API if a configured token is rejected.
  if (token && (response.status === 401 || response.status === 403)) {
    response = await fetchOrThrow(
      endpoint,
      buildStorefrontRequest(query, variables, options, ""),
    );
    // Only latch once tokenless access is confirmed to work, so a transient
    // auth hiccup on both paths doesn't permanently drop a valid token.
    if (response.ok) {
      tokenRejected = true;
    }
  }

  if (!response.ok) {
    throw new ShopifyRequestError(`Shopify Storefront API HTTP ${response.status}`, "http", {
      status: response.status,
    });
  }

  let json: StorefrontResponse<T>;
  try {
    json = (await response.json()) as StorefrontResponse<T>;
  } catch {
    throw new ShopifyRequestError("Invalid response from Shopify", "http", {
      status: response.status,
    });
  }

  if (json.errors && json.errors.length > 0) {
    console.error("Shopify Storefront API errors:", json.errors);
    throw new ShopifyRequestError(json.errors[0]?.message ?? "Shopify API error", "graphql", {
      graphqlErrors: json.errors,
    });
  }

  if (!json.data) {
    throw new ShopifyRequestError("No data returned from Shopify API", "graphql");
  }

  return json.data;
}

// Types for Shopify Storefront Products & Media
export interface StorefrontMoney {
  amount: string;
  currencyCode: string;
}

export interface StorefrontVariant {
  id: string;
  title: string;
  availableForSale: boolean;
  sku?: string | null;
  price: StorefrontMoney;
  compareAtPrice?: StorefrontMoney | null;
}

export interface StorefrontMediaImage {
  mediaContentType: "IMAGE";
  alt?: string | null;
  image: {
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
}

export interface StorefrontModel3dSource {
  url: string;
  mimeType: string;
  format: string;
  filesize: number;
}

export interface StorefrontMediaModel3d {
  mediaContentType: "MODEL_3D";
  alt?: string | null;
  previewImage?: {
    url: string;
  } | null;
  sources: StorefrontModel3dSource[];
}

export interface StorefrontVideoSource {
  url: string;
  mimeType: string;
}

export interface StorefrontMediaVideo {
  mediaContentType: "VIDEO";
  alt?: string | null;
  previewImage?: {
    url: string;
  } | null;
  sources: StorefrontVideoSource[];
}

export interface StorefrontMediaExternalVideo {
  mediaContentType: "EXTERNAL_VIDEO";
  alt?: string | null;
}

export type StorefrontMediaItem =
  | StorefrontMediaImage
  | StorefrontMediaModel3d
  | StorefrontMediaVideo
  | StorefrontMediaExternalVideo;

export interface StorefrontProduct {
  id: string;
  handle: string;
  title: string;
  description: string;
  descriptionHtml: string;
  availableForSale: boolean;
  tags: string[];
  productType: string;
  variants: StorefrontVariant[];
  media: StorefrontMediaItem[];
}

interface StorefrontProductsQueryResponse {
  products: {
    edges: Array<{
      node: {
        id: string;
        handle: string;
        title: string;
        description: string;
        descriptionHtml: string;
        availableForSale: boolean;
        tags: string[];
        productType: string;
        variants: {
          edges: Array<{
            node: StorefrontVariant;
          }>;
        };
        media: {
          edges: Array<{
            node: StorefrontMediaItem;
          }>;
        };
      };
    }>;
  };
}

export function extractNumericVariantId(variantId: string): string {
  return variantId.replace(/^gid:\/\/shopify\/ProductVariant\//, "");
}

export interface FetchStorefrontProductsOptions {
  /**
   * When true, failures are thrown instead of swallowed so callers can tell a
   * failed load apart from a store that genuinely has no products.
   */
  throwOnError?: boolean;
}

// Fetch live products from Shopify Storefront API
export async function fetchStorefrontProducts(
  options: FetchStorefrontProductsOptions = {},
): Promise<StorefrontProduct[]> {
  if (!isStorefrontConfigured()) {
    return [];
  }

  const query = `
    query fetchStorefrontProducts {
      products(first: 50, sortKey: CREATED_AT, reverse: true) {
        edges {
          node {
            id
            handle
            title
            description
            descriptionHtml
            availableForSale
            tags
            productType
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  sku
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
            media(first: 20) {
              edges {
                node {
                  mediaContentType
                  alt
                  ... on MediaImage {
                    image {
                      url
                      altText
                      width
                      height
                    }
                  }
                  ... on Model3d {
                    alt
                    previewImage {
                      url
                    }
                    sources {
                      url
                      mimeType
                      format
                      filesize
                    }
                  }
                  ... on Video {
                    previewImage {
                      url
                    }
                    sources {
                      url
                      mimeType
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const data = await storefrontFetch<StorefrontProductsQueryResponse>(
      query,
      undefined,
      { revalidate: 60 },
    );

    return data.products.edges.map(({ node }) => ({
      id: node.id,
      handle: node.handle,
      title: node.title,
      description: node.description,
      descriptionHtml: node.descriptionHtml,
      availableForSale: node.availableForSale,
      tags: node.tags,
      productType: node.productType,
      variants: node.variants.edges.map((edge) => edge.node),
      media: node.media.edges.map((edge) => edge.node),
    }));
  } catch (error) {
    if (options.throwOnError) {
      throw error;
    }
    console.error("Failed to fetch Shopify Storefront products:", error);
    return [];
  }
}

// Types for Shopify Cart
export interface ShopifyCartLine {
  id: string;
  quantity: number;
  merchandise: {
    id: string;
    title: string;
    product: {
      title: string;
    };
    price: {
      amount: string;
      currencyCode: string;
    };
    image?: {
      url: string;
      altText?: string | null;
    } | null;
  };
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: {
    totalAmount: {
      amount: string;
      currencyCode: string;
    };
    subtotalAmount: {
      amount: string;
      currencyCode: string;
    };
  };
  lines: {
    edges: Array<{
      node: ShopifyCartLine;
    }>;
  };
}

interface CartUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

interface CartMutationPayload {
  cart: ShopifyCart | null;
  userErrors: CartUserError[];
}

// Check if Storefront API is configured (supports Tokenless Storefront API via domain alone)
export function isStorefrontConfigured(): boolean {
  return Boolean(SHOPIFY_DOMAIN);
}

const CART_FIELDS = `
  id
  checkoutUrl
  totalQuantity
  cost {
    totalAmount {
      amount
      currencyCode
    }
    subtotalAmount {
      amount
      currencyCode
    }
  }
  lines(first: 100) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            product {
              title
            }
            price {
              amount
              currencyCode
            }
            image {
              url
              altText
            }
          }
        }
      }
    }
  }
`;

const USER_ERROR_FIELDS = `
  userErrors {
    field
    message
    code
  }
`;

function unwrapCartMutation(
  payload: CartMutationPayload | null | undefined,
  fallbackMessage: string,
): ShopifyCart {
  const firstError = payload?.userErrors?.[0];
  if (firstError) {
    throw new ShopifyUserError(firstError.message || fallbackMessage, {
      code: firstError.code,
      field: firstError.field,
    });
  }
  if (!payload?.cart) {
    // No cart and no explanation: for line mutations this means the cart ID
    // no longer resolves (expired or already checked out).
    throw new ShopifyUserError(fallbackMessage, { code: "CART_NOT_FOUND" });
  }
  return payload.cart;
}

// Create a new Shopify cart
export async function createCart(lines?: { merchandiseId: string; quantity: number }[]): Promise<ShopifyCart> {
  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          ${CART_FIELDS}
        }
        ${USER_ERROR_FIELDS}
      }
    }
  `;

  const input = lines ? { lines } : {};
  const data = await storefrontFetch<{ cartCreate: CartMutationPayload | null }>(query, { input });
  return unwrapCartMutation(data.cartCreate, "Failed to create cart");
}

/**
 * Get an existing cart by ID.
 *
 * Resolves to `null` only when Shopify confirms the cart is gone (expired,
 * completed at checkout, or an invalid ID). Network/HTTP failures are thrown
 * as `ShopifyRequestError` so a transient outage never wipes a shopper's cart.
 */
export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const query = `
    query getCart($cartId: ID!) {
      cart(id: $cartId) {
        ${CART_FIELDS}
      }
    }
  `;

  try {
    // A well-formed but expired/completed cart ID resolves to `cart: null`.
    const data = await storefrontFetch<{ cart: ShopifyCart | null }>(query, { cartId });
    return data.cart;
  } catch (error) {
    if (error instanceof ShopifyRequestError && error.isInvalidIdError) {
      // Shopify rejected the stored ID itself as malformed — it can never load.
      return null;
    }
    // Throttling, internal errors, timeouts, outages: keep the cart ID.
    throw error;
  }
}

// Add items to cart
export async function addToCart(
  cartId: string,
  lines: { merchandiseId: string; quantity: number }[]
): Promise<ShopifyCart> {
  const query = `
    mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FIELDS}
        }
        ${USER_ERROR_FIELDS}
      }
    }
  `;

  const data = await storefrontFetch<{ cartLinesAdd: CartMutationPayload | null }>(
    query,
    { cartId, lines }
  );
  return unwrapCartMutation(data.cartLinesAdd, "Failed to add to cart");
}

// Update cart line quantities
export async function updateCartLines(
  cartId: string,
  lines: { id: string; quantity: number }[]
): Promise<ShopifyCart> {
  const query = `
    mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
        cart {
          ${CART_FIELDS}
        }
        ${USER_ERROR_FIELDS}
      }
    }
  `;

  const data = await storefrontFetch<{ cartLinesUpdate: CartMutationPayload | null }>(
    query,
    { cartId, lines }
  );
  return unwrapCartMutation(data.cartLinesUpdate, "Failed to update cart");
}

// Remove items from cart
export async function removeFromCart(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const query = `
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          ${CART_FIELDS}
        }
        ${USER_ERROR_FIELDS}
      }
    }
  `;

  const data = await storefrontFetch<{ cartLinesRemove: CartMutationPayload | null }>(
    query,
    { cartId, lineIds }
  );
  return unwrapCartMutation(data.cartLinesRemove, "Failed to remove from cart");
}
