// Shopify configuration
const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "pca-moped-parts.myshopify.com";
const STOREFRONT_ACCESS_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? "";

// Map product IDs to Shopify variant IDs (GraphQL global IDs)
export const SHOPIFY_VARIANT_IDS: Record<string, string> = {
  "fork-spacers": "gid://shopify/ProductVariant/42530734080098",
  "chain-tensioner": "gid://shopify/ProductVariant/42530733424738",
};

// Legacy numeric IDs for permalink checkout
export const SHOPIFY_NUMERIC_VARIANT_IDS: Record<string, string> = {
  "fork-spacers": "42530734080098",
  "chain-tensioner": "42530733424738",
};

export function getShopifyVariantId(productId: string): string | null {
  return SHOPIFY_VARIANT_IDS[productId] ?? null;
}

// Create a permalink checkout URL (fallback method)
export function createCheckoutUrl(items: { variantId: string; quantity: number }[]): string {
  const cartItems = items.map((item) => `${item.variantId}:${item.quantity}`).join(",");
  return `https://${SHOPIFY_DOMAIN}/cart/${cartItems}`;
}

// Storefront API response type
interface StorefrontResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

// Storefront API client
async function storefrontFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": STOREFRONT_ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

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

// Check if Storefront API is configured
export function isStorefrontConfigured(): boolean {
  return Boolean(STOREFRONT_ACCESS_TOKEN);
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
