// Shopify configuration
const SHOPIFY_DOMAIN = "pca-moped-parts.myshopify.com";

// Map product IDs to Shopify variant IDs
export const SHOPIFY_VARIANT_IDS: Record<string, string> = {
  "fork-spacers": "42530734080098",
  "chain-tensioner": "42530733424738",
};

export function getShopifyVariantId(productId: string): string | null {
  return SHOPIFY_VARIANT_IDS[productId] ?? null;
}

// Create a checkout URL for multiple items
// Format: /cart/VARIANT_ID:QTY,VARIANT_ID:QTY
export function createCheckoutUrl(items: { variantId: string; quantity: number }[]): string {
  const cartItems = items.map((item) => `${item.variantId}:${item.quantity}`).join(",");
  return `https://${SHOPIFY_DOMAIN}/cart/${cartItems}`;
}
