import { randomBytes } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSnapTransaction, isMidtransConfigured } from "@/lib/payments/midtrans";
import { APP_NAME } from "@/lib/config";
import { SITE_URL } from "@/lib/site";
import { PERIOD_LABEL } from "@/lib/pricing";
import type { BillingPeriod, PlanCode } from "@/lib/pricing";

export interface Renewal {
  id: string;
  organizationId: string;
  organizationName: string | null;
  planCode: PlanCode;
  planName: string | null;
  billingPeriod: BillingPeriod;
  users: number;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  requestedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  paymentUrl: string | null;
  kind: "renewal" | "seats";
  seatsAdded: number | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  receiptNumber: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  provider: string;
  issuer: BillingParty | null;
  billTo: BillingParty | null;
  items: BillingItem[];
}

export interface BillingParty {
  name: string;
  address: string | null;
  email: string | null;
  website?: string | null;
  footer?: string | null;
}

export interface BillingItem {
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
}

type Row = {
  id: string;
  organization_id: string;
  plan_code: PlanCode;
  billing_period: BillingPeriod;
  users: number;
  amount: number | string;
  status: Renewal["status"];
  requested_at: string;
  period_start: string | null;
  period_end: string | null;
  payment_url: string | null;
  kind: "renewal" | "seats";
  seats_added: number | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  receipt_number: string | null;
  paid_at: string | null;
  payment_method: string | null;
  provider: string;
  issuer: BillingParty | null;
  bill_to: BillingParty | null;
  items: BillingItem[] | null;
  organizations: { name: string } | { name: string }[] | null;
  subscription_plans: { name: string } | { name: string }[] | null;
};

const COLUMNS =
  "id, organization_id, plan_code, billing_period, users, amount, status, requested_at, period_start, period_end, payment_url, kind, seats_added, invoice_number, invoice_date, due_date, receipt_number, paid_at, payment_method, provider, issuer, bill_to, items, organizations(name), subscription_plans(name)";

const first = <T>(value: T | T[] | null): T | null => (Array.isArray(value) ? value[0] ?? null : value);

function toRenewal(row: Row): Renewal {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: first(row.organizations)?.name ?? null,
    planCode: row.plan_code,
    planName: first(row.subscription_plans)?.name ?? null,
    billingPeriod: row.billing_period,
    users: row.users,
    amount: Number(row.amount),
    status: row.status,
    requestedAt: row.requested_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    paymentUrl: row.payment_url,
    kind: row.kind,
    seatsAdded: row.seats_added,
    invoiceNumber: row.invoice_number,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    receiptNumber: row.receipt_number,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    provider: row.provider,
    issuer: row.issuer,
    billTo: row.bill_to,
    items: (row.items ?? []).map((item) => ({ ...item, qty: Number(item.qty), unit_price: Number(item.unit_price), amount: Number(item.amount) })),
  };
}

export async function getPendingRenewal(organizationId: string): Promise<Renewal | null> {
  const { data } = await createAdminSupabaseClient()
    .from("subscription_renewals")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .maybeSingle();
  return data ? toRenewal(data as unknown as Row) : null;
}

export async function listRenewals(organizationId: string): Promise<Renewal[]> {
  const { data } = await createAdminSupabaseClient()
    .from("subscription_renewals")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .order("requested_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as Row[]).map(toRenewal);
}

export async function getRenewal(id: string): Promise<Renewal | null> {
  const { data } = await createAdminSupabaseClient().from("subscription_renewals").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toRenewal(data as unknown as Row) : null;
}

export async function listPendingRenewals(): Promise<Renewal[]> {
  const { data } = await createAdminSupabaseClient()
    .from("subscription_renewals")
    .select(COLUMNS)
    .eq("status", "pending")
    .order("requested_at");
  return ((data ?? []) as unknown as Row[]).map(toRenewal);
}

export async function requestRenewal(organizationId: string, requestedBy: string | null, plan: PlanCode, period: BillingPeriod, seats: number) {
  return createAdminSupabaseClient().rpc("request_renewal", {
    p_org: organizationId,
    p_owner: requestedBy,
    p_plan: plan,
    p_period: period,
    p_seats: seats,
  });
}

export async function requestSeatPurchase(organizationId: string, requestedBy: string | null, add: number) {
  return createAdminSupabaseClient().rpc("request_seat_purchase", {
    p_org: organizationId,
    p_requested_by: requestedBy,
    p_add: add,
  });
}

export async function confirmRenewal(renewalId: string, actor: string, provider = "manual", providerRef: string | null = null) {
  return createAdminSupabaseClient().rpc("confirm_renewal", {
    p_renewal_id: renewalId,
    p_actor: actor,
    p_provider: provider,
    p_provider_ref: providerRef,
  });
}

function snapItems(renewal: Renewal) {
  const amount = Math.round(renewal.amount);
  const lines = renewal.items.map((item) => ({ name: item.description, price: Math.round(item.unit_price), quantity: item.qty }));
  if (lines.length && lines.reduce((sum, line) => sum + line.price * line.quantity, 0) === amount) return lines;
  const name =
    renewal.kind === "seats"
      ? `${APP_NAME} tambah ${renewal.seatsAdded} seat`
      : `${APP_NAME} ${renewal.planName ?? renewal.planCode} ${PERIOD_LABEL[renewal.billingPeriod]}`;
  return [{ name, price: amount, quantity: 1 }];
}

export async function preparePayment(renewal: Renewal, customer: { name: string; email: string }): Promise<string | null> {
  if (!isMidtransConfigured() || renewal.status !== "pending") return null;
  if (renewal.paymentUrl) return renewal.paymentUrl;
  const orderId = `${renewal.id.slice(0, 8)}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const url = await createSnapTransaction({
    orderId,
    amount: Math.round(renewal.amount),
    items: snapItems(renewal),
    customer,
    finishUrl: `${SITE_URL}/admin/plan?bayar=selesai`,
  });
  if (!url) return null;
  const { error } = await createAdminSupabaseClient()
    .from("subscription_renewals")
    .update({ payment_order_id: orderId, payment_url: url })
    .eq("id", renewal.id)
    .eq("status", "pending");
  return error ? null : url;
}

export async function getBillingProfile(organizationId: string): Promise<{ address: string | null; email: string | null }> {
  const { data } = await createAdminSupabaseClient()
    .from("organizations")
    .select("billing_address, billing_email")
    .eq("id", organizationId)
    .maybeSingle();
  return { address: (data?.billing_address as string | null) ?? null, email: (data?.billing_email as string | null) ?? null };
}

export const RENEWAL_STATUS_LABEL: Record<Renewal["status"], string> = {
  pending: "Menunggu pembayaran",
  paid: "Lunas",
  cancelled: "Dibatalkan",
};
