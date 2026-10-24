import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTransactionStatus, isPaid, isValidSignature, paymentMethodLabel } from "@/lib/payments/midtrans";
import { confirmRenewal } from "@/lib/billing/renewals";
import { logAudit } from "@/lib/audit";

const CLOSED = new Set(["expire", "cancel", "deny", "failure"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, string> | null;
  if (!body || !isValidSignature(body)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  const status = await getTransactionStatus(body.order_id);
  if (!status) return NextResponse.json({ error: "status unavailable" }, { status: 502 });

  const supabase = createAdminSupabaseClient();
  const { data: renewal } = await supabase
    .from("subscription_renewals")
    .select("id, organization_id, amount, status")
    .eq("payment_order_id", status.order_id)
    .maybeSingle();
  if (!renewal) return NextResponse.json({ ok: true });

  if (isPaid(status)) {
    if (Math.round(Number(status.gross_amount)) !== Math.round(Number(renewal.amount))) {
      console.error("midtrans: amount mismatch");
      return NextResponse.json({ error: "amount mismatch" }, { status: 409 });
    }
    const { data: periodEnd, error } = await confirmRenewal(renewal.id, "midtrans", "midtrans", status.transaction_id);
    if (error) {
      console.error(`midtrans: confirm failed ${error.code ?? ""}`);
      return NextResponse.json({ error: "confirm failed" }, { status: 500 });
    }
    const method = paymentMethodLabel(status);
    if (method) await supabase.from("subscription_renewals").update({ payment_method: method }).eq("id", renewal.id).is("payment_method", null);
    if (renewal.status !== "paid") await logAudit({
      action: "subscription.renewal_confirm",
      targetType: "renewal",
      targetId: renewal.id,
      organizationId: renewal.organization_id,
      details: { provider: "midtrans", transaction: status.transaction_id, periodEnd },
      actorRole: "system",
      actorLabel: "midtrans",
    });
  } else if (CLOSED.has(status.transaction_status) && renewal.status === "pending") {
    await supabase
      .from("subscription_renewals")
      .update({ payment_order_id: null, payment_url: null })
      .eq("id", renewal.id)
      .eq("payment_order_id", status.order_id);
  }

  return NextResponse.json({ ok: true });
}
