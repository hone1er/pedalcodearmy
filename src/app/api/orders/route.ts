import { NextResponse } from "next/server";
import { createOrder, initializeDatabase, getOrders, type OrderInput } from "@/lib/db";

// Initialize database on first request
let dbInitialized = false;

async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error("Failed to initialize database:", error);
      throw error;
    }
  }
}

type OrderRequestBody = {
  product?: string;
  customerName?: string;
  customerEmail?: string;
  quantity?: number;
  sideOption?: string;
  leftText?: string;
  rightText?: string;
  font?: string;
  textSize?: string;
  isCustom?: boolean;
  estimatedPrice?: string;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    await ensureDbInitialized();

    const body = (await request.json()) as OrderRequestBody;

    // Validate required fields
    if (!body.customerEmail || !body.customerName || !body.product) {
      return NextResponse.json(
        { error: "Missing required fields: customerName, customerEmail, product" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.customerEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const orderInput: OrderInput = {
      product: body.product,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      quantity: body.quantity ?? 1,
      sideOption: body.sideOption,
      leftText: body.leftText,
      rightText: body.rightText,
      font: body.font,
      textSize: body.textSize,
      isCustom: body.isCustom ?? false,
      estimatedPrice: body.estimatedPrice,
      notes: body.notes,
    };

    const result = await createOrder(orderInput);

    return NextResponse.json(
      {
        success: true,
        message: "Order submitted successfully",
        orderId: result?.id,
        createdAt: result?.created_at
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to submit order. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await ensureDbInitialized();
    const orders = await getOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}
