import { sql } from "@vercel/postgres";

export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      product VARCHAR(100) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      customer_email VARCHAR(255) NOT NULL,
      quantity INTEGER DEFAULT 1,
      side_option VARCHAR(20),
      left_text VARCHAR(50),
      right_text VARCHAR(50),
      font VARCHAR(100),
      text_size VARCHAR(20),
      is_custom BOOLEAN DEFAULT FALSE,
      estimated_price VARCHAR(20),
      notes TEXT,
      status VARCHAR(50) DEFAULT 'waitlist'
    )
  `;
}

export type OrderInput = {
  product: string;
  customerName: string;
  customerEmail: string;
  quantity: number;
  sideOption?: string;
  leftText?: string;
  rightText?: string;
  font?: string;
  textSize?: string;
  isCustom?: boolean;
  estimatedPrice?: string;
  notes?: string;
};

type OrderResult = {
  id: number;
  created_at: string;
};

export async function createOrder(order: OrderInput): Promise<OrderResult | undefined> {
  const result = await sql<OrderResult>`
    INSERT INTO orders (
      product,
      customer_name,
      customer_email,
      quantity,
      side_option,
      left_text,
      right_text,
      font,
      text_size,
      is_custom,
      estimated_price,
      notes
    ) VALUES (
      ${order.product},
      ${order.customerName},
      ${order.customerEmail},
      ${order.quantity},
      ${order.sideOption ?? null},
      ${order.leftText ?? null},
      ${order.rightText ?? null},
      ${order.font ?? null},
      ${order.textSize ?? null},
      ${order.isCustom ?? false},
      ${order.estimatedPrice ?? null},
      ${order.notes ?? null}
    )
    RETURNING id, created_at
  `;
  return result.rows[0];
}

export async function getOrders() {
  const result = await sql`
    SELECT * FROM orders
    ORDER BY created_at DESC
  `;
  return result.rows;
}
