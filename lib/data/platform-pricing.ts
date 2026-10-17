import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { BillingPeriod, PlanCode, PricingPlan, Quote } from "@/lib/pricing";
import type { PlatformSubscriptionStatus } from "@/lib/validations/superadmin";
import { billingPhase, graceEndsOn, type BillingPhase } from "@/lib/billing/access";

type One<T> = T | T[] | null;
const one = <T>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);
type BillingStateRow = {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  subscription_plans: One<{ grace_days: number }>;
};

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
  seats: number;
  pendingSeats: number | null;
  pendingSeatsFrom: string | null;
}

interface PlanRow {
  code: PlanCode;
  name: string;
  price_per_seat_month: number | string;
  club_limit: number | null;
  trial_days: number;
  yearly_free_months: number | string;
  grace_days: number;
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
  seats: number;
  pending_seats: number | null;
  pending_seats_from: string | null;
}

export const PLAN_COLUMNS = "code, name, price_per_seat_month, club_limit, trial_days, yearly_free_months, grace_days";
export const SUBSCRIPTION_COLUMNS =
  "organization_id, plan_code, billing_period, status, trial_ends_at, current_period_start, current_period_end, club_limit_override, seats, pending_seats, pending_seats_from";

export function toPlan(row: PlanRow): PricingPlan {
  return {
    code: row.code,
    name: row.name,
    pricePerUserMonth: Number(row.price_per_seat_month),
    clubLimit: row.club_limit,
    trialDays: row.trial_days,
    yearlyFreeMonths: Number(row.yearly_free_months),
    graceDays: row.grace_days,
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
    seats: row.seats,
    pendingSeats: row.pending_seats,
    pendingSeatsFrom: row.pending_seats_from,
  };
}

export async function getActivePlans(): Promise<PricingPlan[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("subscription_plans")
      .select(PLAN_COLUMNS)
      .eq("is_active", true)
      .order("price_per_seat_month");
    return ((data ?? []) as PlanRow[]).map(toPlan);
  } catch {
    return [];
  }
}

export async function getModules(): Promise<PlatformModule[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.from("platform_modules").select("code, name, description, status").order("sort_order");
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
  const { data } = await createAdminSupabaseClient().rpc("organization_seats_used", { p_org: organizationId });
  return Number(data ?? 0);
}

export interface OrganizationBilling {
  subscription: OrganizationSubscription;
  plan: PricingPlan;
  plans: PricingPlan[];
  clubs: number;
  clubLimit: number | null;
  seatsUsed: number;
  quote: Quote;
  phase: BillingPhase;
  graceEndsOn: string | null;
}

export async function getOrganizationBilling(organizationId: string): Promise<OrganizationBilling | null> {
  const supabase = createAdminSupabaseClient();
  const [{ data: sub }, { data: planRows }, { count: clubs }, seatsUsed] = await Promise.all([
    supabase.from("organization_subscriptions").select(SUBSCRIPTION_COLUMNS).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("subscription_plans").select(PLAN_COLUMNS).eq("is_active", true).order("price_per_seat_month"),
    supabase.from("clubs").select("id", { count: "exact", head: true }).eq("organization_id", organizationId),
    internalUserCount(organizationId),
  ]);
  if (!sub) return null;
  const subscription = toSubscription(sub as SubscriptionRow);
  const { data: current } = await supabase.from("subscription_plans").select(PLAN_COLUMNS).eq("code", subscription.planCode).single();
  if (!current) return null;
  const plan = toPlan(current as PlanRow);
  const quote = await serverQuote(subscription.planCode, subscription.billingPeriod, subscription.pendingSeats ?? subscription.seats);
  if (!quote) return null;
  const state = {
    status: subscription.status,
    trial_ends_at: subscription.trialEndsAt,
    current_period_end: subscription.currentPeriodEnd,
    grace_days: plan.graceDays,
  };
  return {
    subscription,
    plan,
    plans: ((planRows ?? []) as PlanRow[]).map(toPlan),
    clubs: clubs ?? 0,
    clubLimit: effectiveClubLimit(plan, subscription),
    seatsUsed,
    quote,
    phase: billingPhase(state),
    graceEndsOn: graceEndsOn(state),
  };
}

export interface SeatUsage {
  seats: number;
  used: number;
  full: boolean;
}

export async function seatUsage(organizationId: string): Promise<SeatUsage | null> {
  const supabase = createAdminSupabaseClient();
  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("seats, pending_seats")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!sub) return null;
  const used = await internalUserCount(organizationId);
  const seats = Math.min(sub.seats as number, (sub.pending_seats as number | null) ?? (sub.seats as number));
  return { seats, used, full: used >= seats };
}

export async function getGraceEndsOn(tenantId: string): Promise<string | null> {
  const { data } = await createAdminSupabaseClient()
    .from("clubs")
    .select("organizations(organization_subscriptions(status, trial_ends_at, current_period_end, subscription_plans(grace_days)))")
    .eq("id", tenantId)
    .maybeSingle();
  const org = one(data?.organizations as unknown as One<{ organization_subscriptions: One<BillingStateRow> }>);
  const sub = one(org?.organization_subscriptions ?? null);
  if (!sub) return null;
  return graceEndsOn({
    status: sub.status,
    trial_ends_at: sub.trial_ends_at,
    current_period_end: sub.current_period_end,
    grace_days: one(sub.subscription_plans)?.grace_days ?? 0,
  });
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
    .from("organization_users")
    .select("id, full_name, email, base_role, organization_member_clubs:organization_user_clubs(tenants:clubs(name))")
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
