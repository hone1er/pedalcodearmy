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

// Legacy numeric IDs for permalink checkout
export const SHOPIFY_NUMERIC_VARIANT_IDS: Record<string, string> = {
  "fork-spacers": "42530734080098",
  "chain-tensioner": "42530733424738",
  "headlight-bracket-pa50": "42629262442594",
};

export function getShopifyVariantId(productId: string): string | null {
  return SHOPIFY_VARIANT_IDS[productId] ?? null;
}

// Create a permalink checkout URL (fallback method)
export function createCheckoutUrl(items: { variantId: string; quantity: number }[]): string {
  const cartItems = items.map((item) => {
    // Strip GraphQL prefix if present to get numeric variant ID
    const numericId = item.variantId.replace("gid://shopify/ProductVariant/", "");
    return `${numericId}:${item.quantity}`;
  }).join(",");
  return `https://${SHOPIFY_DOMAIN}/cart/${cartItems}`;
}

// Storefront API response type
interface StorefrontResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
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

  if (typeof window === "undefined" && options?.revalidate !== undefined) {
    fetchInit.next = { revalidate: options.revalidate };
  }

  return fetchInit;
}

// Storefront API client
async function storefrontFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options?: StorefrontFetchOptions,
): Promise<T> {
  const endpoint = `https://${SHOPIFY_DOMAIN}/api/2025-01/graphql.json`;
  const token = tokenRejected ? "" : STOREFRONT_ACCESS_TOKEN;

  let response = await fetch(
    endpoint,
    buildStorefrontRequest(query, variables, options, token),
  );

  // Fall back to Shopify's Tokenless Storefront API if a configured token is rejected.
  if (token && (response.status === 401 || response.status === 403)) {
    tokenRejected = true;
    response = await fetch(
      endpoint,
      buildStorefrontRequest(query, variables, options, ""),
    );
  }

  if (!response.ok) {
    throw new Error(`Shopify Storefront API HTTP ${response.status}`);
  }

  const json = (await response.json()) as StorefrontResponse<T>;

  if (json.errors && json.errors.length > 0) {
    console.error("Shopify Storefront API errors:", json.errors);
    throw new Error(json.errors[0]?.message ?? "Shopify API error");
  }

  if (!json.data) {
    throw new Error("No data returned from Shopify API");
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

// Fetch live products from Shopify Storefront API
export async function fetchStorefrontProducts(): Promise<StorefrontProduct[]> {
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
      altText?: string;
    };
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

// Check if Storefront API is configured (supports Tokenless Storefront API via domain alone)
export function isStorefrontConfigured(): boolean {
  return Boolean(SHOPIFY_DOMAIN);
}

// Create a new Shopify cart
export async function createCart(lines?: { merchandiseId: string; quantity: number }[]): Promise<ShopifyCart> {
  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
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
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = lines ? { lines } : {};
  const data = await storefrontFetch<{ cartCreate: { cart: ShopifyCart; userErrors: Array<{ message: string }> } }>(query, { input });

  if (data.cartCreate.userErrors.length > 0) {
    throw new Error(data.cartCreate.userErrors[0]?.message ?? "Failed to create cart");
  }

  return data.cartCreate.cart;
}

// Get an existing cart by ID
export async function getCart(cartId: string): Promise<ShopifyCart | null> {
  const query = `
    query getCart($cartId: ID!) {
      cart(id: $cartId) {
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
      }
    }
  `;

  try {
    const data = await storefrontFetch<{ cart: ShopifyCart | null }>(query, { cartId });
    return data.cart;
  } catch {
    return null;
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
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await storefrontFetch<{ cartLinesAdd: { cart: ShopifyCart; userErrors: Array<{ message: string }> } }>(
    query,
    { cartId, lines }
  );

  if (data.cartLinesAdd.userErrors.length > 0) {
    throw new Error(data.cartLinesAdd.userErrors[0]?.message ?? "Failed to add to cart");
  }

  return data.cartLinesAdd.cart;
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
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await storefrontFetch<{ cartLinesUpdate: { cart: ShopifyCart; userErrors: Array<{ message: string }> } }>(
    query,
    { cartId, lines }
  );

  if (data.cartLinesUpdate.userErrors.length > 0) {
    throw new Error(data.cartLinesUpdate.userErrors[0]?.message ?? "Failed to update cart");
  }

  return data.cartLinesUpdate.cart;
}

// Remove items from cart
export async function removeFromCart(cartId: string, lineIds: string[]): Promise<ShopifyCart> {
  const query = `
    mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
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
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const data = await storefrontFetch<{ cartLinesRemove: { cart: ShopifyCart; userErrors: Array<{ message: string }> } }>(
    query,
    { cartId, lineIds }
  );

  if (data.cartLinesRemove.userErrors.length > 0) {
    throw new Error(data.cartLinesRemove.userErrors[0]?.message ?? "Failed to remove from cart");
  }

  return data.cartLinesRemove.cart;
}
