import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { BillingPeriod, PlanCode, PricingPlan, Quote } from "@/lib/pricing";
import type { PlatformSubscriptionStatus } from "@/lib/validations/superadmin";

export interface PlatformModule {
  code: string;
  name: string;
  description: string | null;
  status: "ready" | "soon";
}

export interface OrganizationSubscription {
  organizationId: string;
  planCode: PlanCode;
  billingPeriod: BillingPeriod;
  status: PlatformSubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  clubLimitOverride: number | null;
}

interface PlanRow {
  code: PlanCode;
  name: string;
  price_per_user_month: number | string;
  club_limit: number | null;
  trial_days: number;
  yearly_free_months: number | string;
}

interface SubscriptionRow {
  organization_id: string;
  plan_code: PlanCode;
  billing_period: BillingPeriod;
  status: PlatformSubscriptionStatus;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  club_limit_override: number | null;
}

export const PLAN_COLUMNS = "code, name, price_per_user_month, club_limit, trial_days, yearly_free_months";
export const SUBSCRIPTION_COLUMNS =
  "organization_id, plan_code, billing_period, status, trial_ends_at, current_period_start, current_period_end, club_limit_override";

export function toPlan(row: PlanRow): PricingPlan {
  return {
    code: row.code,
    name: row.name,
    pricePerUserMonth: Number(row.price_per_user_month),
    clubLimit: row.club_limit,
    trialDays: row.trial_days,
    yearlyFreeMonths: Number(row.yearly_free_months),
  };
}

export function toSubscription(row: SubscriptionRow): OrganizationSubscription {
  return {
    organizationId: row.organization_id,
    planCode: row.plan_code,
    billingPeriod: row.billing_period,
    status: row.status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    clubLimitOverride: row.club_limit_override,
  };
}

export async function getActivePlans(): Promise<PricingPlan[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select(PLAN_COLUMNS)
      .eq("is_active", true)
      .order("price_per_user_month");
    return ((data ?? []) as PlanRow[]).map(toPlan);
  } catch {
    return [];
  }
}

export async function getModules(): Promise<PlatformModule[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("platform_modules").select("code, name, description, status").order("sort");
    return (data ?? []) as PlatformModule[];
  } catch {
    return [];
  }
}

export async function getOwnSubscription(): Promise<OrganizationSubscription | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("organization_subscriptions").select(SUBSCRIPTION_COLUMNS).maybeSingle();
  return data ? toSubscription(data as SubscriptionRow) : null;
}

export function effectiveClubLimit(plan: PricingPlan | null, subscription: OrganizationSubscription | null): number | null {
  return subscription?.clubLimitOverride ?? plan?.clubLimit ?? null;
}

export async function serverQuote(plan: PlanCode, period: BillingPeriod, users: number): Promise<Quote | null> {
  const { data, error } = await createAdminSupabaseClient().rpc("platform_quote", {
    p_plan: plan,
    p_period: period,
    p_users: users,
  });
  const row = (data as Record<string, number | string>[] | null)?.[0];
  if (error || !row) return null;
  return {
    users: Number(row.users),
    unitPrice: Number(row.unit_price),
    months: Number(row.months),
    total: Number(row.total),
    perMonth: Number(row.per_month),
  };
}

export async function internalUserCount(organizationId: string): Promise<number> {
  const { data } = await createAdminSupabaseClient().rpc("organization_internal_users", { p_org: organizationId });
  return Number(data ?? 0);
}

export interface OrganizationBilling {
  subscription: OrganizationSubscription;
  plan: PricingPlan;
  plans: PricingPlan[];
  clubs: number;
  clubLimit: number | null;
  internalUsers: number;
  quote: Quote;
}

export async function getOrganizationBilling(organizationId: string): Promise<OrganizationBilling | null> {
  const supabase = createAdminSupabaseClient();
  const [{ data: sub }, { data: planRows }, { count: clubs }, internalUsers] = await Promise.all([
    supabase.from("organization_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("subscription_plans").select(PLAN_COLUMNS).eq("is_active", true).order("price_per_user_month"),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    internalUserCount(organizationId),
  ]);
  if (!sub) return null;
  const subscription = toSubscription(sub as SubscriptionRow);
  const { data: current } = await supabase.from("subscription_plans").select(PLAN_COLUMNS).eq("code", subscription.planCode).single();
  if (!current) return null;
  const plan = toPlan(current as PlanRow);
  const quote = await serverQuote(subscription.planCode, subscription.billingPeriod, internalUsers);
  if (!quote) return null;
  return {
    subscription,
    plan,
    plans: ((planRows ?? []) as PlanRow[]).map(toPlan),
    clubs: clubs ?? 0,
    clubLimit: effectiveClubLimit(plan, subscription),
    internalUsers,
    quote,
  };
}

export interface InternalUserCostChange {
  planName: string;
  period: BillingPeriod;
  usersBefore: number;
  usersAfter: number;
  perMonthBefore: number;
  perMonthAfter: number;
}

export async function internalUserCostChange(organizationId: string): Promise<InternalUserCostChange | null> {
  const supabase = createAdminSupabaseClient();
  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("plan_code, billing_period, subscription_plans(name)")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!sub) return null;
  const users = await internalUserCount(organizationId);
  const [before, after] = await Promise.all([
    serverQuote(sub.plan_code as PlanCode, sub.billing_period as BillingPeriod, users),
    serverQuote(sub.plan_code as PlanCode, sub.billing_period as BillingPeriod, users + 1),
  ]);
  if (!before || !after) return null;
  return {
    planName: (sub.subscription_plans as unknown as { name: string }).name,
    period: sub.billing_period as BillingPeriod,
    usersBefore: before.users,
    usersAfter: after.users,
    perMonthBefore: before.perMonth,
    perMonthAfter: after.perMonth,
  };
}

export interface InternalUserRow {
  key: string;
  name: string;
  email: string;
  roleLabel: string;
  clubName: string | null;
}

export async function listInternalUsers(organizationId: string): Promise<InternalUserRow[]> {
  const { data } = await createAdminSupabaseClient()
    .from("organization_members")
    .select("id, full_name, email, base_role, organization_member_clubs(tenants(name))")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("full_name");
  const labels: Record<string, string> = { p_owner: "Pemilik utama", owner: "Pemilik", staff: "Staf" };
  return (data ?? []).map((m) => {
    const clubs = ((m.organization_member_clubs as unknown as { tenants: { name: string } | { name: string }[] | null }[] | null) ?? [])
      .map((c) => (Array.isArray(c.tenants) ? c.tenants[0]?.name : c.tenants?.name))
      .filter(Boolean);
    return {
      key: `member-${m.id}`,
      name: m.full_name as string,
      email: m.email as string,
      roleLabel: labels[m.base_role as string] ?? "Staf",
      clubName: m.base_role === "staff" ? clubs.join(", ") || null : null,
    };
  });
}
