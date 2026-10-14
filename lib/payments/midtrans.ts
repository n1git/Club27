import { createHash, timingSafeEqual } from "node:crypto";

const isProduction = () => process.env.MIDTRANS_IS_PRODUCTION === "true";
const snapBase = () => (isProduction() ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com");
const apiBase = () => (isProduction() ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com");

export function isMidtransConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}

function authHeader() {
  return `Basic ${Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString("base64")}`;
}

export interface SnapInput {
  orderId: string;
  amount: number;
  itemName: string;
  customer: { name: string; email: string };
  finishUrl: string;
}

export async function createSnapTransaction(input: SnapInput): Promise<string | null> {
  try {
    const res = await fetch(`${snapBase()}/snap/v1/transactions`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: input.amount },
        item_details: [{ id: "langganan", name: input.itemName.slice(0, 50), price: input.amount, quantity: 1 }],
        customer_details: { first_name: input.customer.name.slice(0, 255), email: input.customer.email },
        callbacks: { finish: input.finishUrl },
      }),
    });
    if (!res.ok) {
      console.error(`midtrans: snap failed with status ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { redirect_url?: string };
    return data.redirect_url ?? null;
  } catch {
    console.error("midtrans: snap request failed");
    return null;
  }
}

export interface MidtransStatus {
  order_id: string;
  transaction_id: string;
  transaction_status: string;
  fraud_status?: string;
  gross_amount: string;
  status_code: string;
}

export async function getTransactionStatus(orderId: string): Promise<MidtransStatus | null> {
  try {
    const res = await fetch(`${apiBase()}/v2/${encodeURIComponent(orderId)}/status`, {
      headers: { Authorization: authHeader(), Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as MidtransStatus;
  } catch {
    return null;
  }
}

export function isValidSignature(body: { order_id?: string; status_code?: string; gross_amount?: string; signature_key?: string }) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key || !body.order_id || !body.status_code || !body.gross_amount || !body.signature_key) return false;
  const expected = createHash("sha512").update(`${body.order_id}${body.status_code}${body.gross_amount}${key}`).digest();
  const given = Buffer.from(body.signature_key, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function isPaid(status: MidtransStatus) {
  if (status.transaction_status === "settlement") return true;
  return status.transaction_status === "capture" && (status.fraud_status ?? "accept") === "accept";
}
