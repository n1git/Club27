import { createAdminSupabaseClient } from "@/lib/supabase/admin";
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
  organizations: { name: string } | { name: string }[] | null;
  subscription_plans: { name: string } | { name: string }[] | null;
};

const COLUMNS =
  "id, organization_id, plan_code, billing_period, users, amount, status, requested_at, period_start, period_end, organizations(name), subscription_plans(name)";

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

export async function listPendingRenewals(): Promise<Renewal[]> {
  const { data } = await createAdminSupabaseClient()
    .from("subscription_renewals")
    .select(COLUMNS)
    .eq("status", "pending")
    .order("requested_at");
  return ((data ?? []) as unknown as Row[]).map(toRenewal);
}

export async function requestRenewal(organizationId: string, ownerId: string, plan: PlanCode, period: BillingPeriod) {
  return createAdminSupabaseClient().rpc("request_renewal", {
    p_org: organizationId,
    p_owner: ownerId,
    p_plan: plan,
    p_period: period,
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
