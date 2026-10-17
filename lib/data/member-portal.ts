import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface MemberSubscription {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  packageName: string;
  pricingMode: "cycle" | "session_pack";
  billingCycle: string | null;
  sessionsIncluded: number | null;
  sessionsUsed: number | null;
  sessionsRemaining: number | null;
}

export interface MemberInvoice {
  id: string;
  amount: number;
  status: string;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
}

export interface MemberClass {
  id: string;
  startTime: string;
  endTime: string;
  locationName: string;
  classTypeName: string;
}

export interface MemberPromo {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
}

export interface MemberOverview {
  fullName: string;
  subscriptions: MemberSubscription[];
  invoices: MemberInvoice[];
  classes: MemberClass[];
  promos: MemberPromo[];
}

export async function getMemberOverview(): Promise<MemberOverview | null> {
  const supabase = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const [{ data: member }, { data: subs }, { data: usage }, { data: invoices }, { data: bookings }, { data: promos }] =
    await Promise.all([
      supabase.from("club_members").select("id, full_name").maybeSingle(),
      supabase
        .from("member_memberships")
        .select("id, status, start_date, end_date, membership_packages(name, pricing_mode, billing_period)")
        .order("start_date", { ascending: false }),
      supabase.from("my_membership_usage").select("subscription_id, sessions_included, sessions_used, sessions_remaining"),
      supabase
        .from("invoices")
        .select("id, amount, status, due_date, period_start, period_end, paid_at")
        .order("due_date", { ascending: false })
        .limit(24),
      supabase
        .from("class_bookings")
        .select("id, classes!inner(id, start_time, end_time, locations(name), class_types(name))")
        .gte("classes.start_time", nowIso),
      supabase
        .from("promos")
        .select("id, title, body, image_url")
        .lte("active_from", nowIso)
        .or(`active_until.is.null,active_until.gte.${nowIso}`)
        .order("active_from", { ascending: false }),
    ]);

  if (!member) return null;

  const usageBySub = new Map((usage ?? []).map((u) => [u.subscription_id as string, u]));

  return {
    fullName: member.full_name as string,
    subscriptions: (subs ?? []).map((s) => {
      const pkg = s.membership_packages as unknown as {
        name: string;
        pricing_mode: "cycle" | "session_pack";
        billing_period: string | null;
      } | null;
      const u = usageBySub.get(s.id as string);
      return {
        id: s.id as string,
        status: s.status as string,
        startDate: s.start_date as string,
        endDate: (s.end_date as string | null) ?? null,
        packageName: pkg?.name ?? "-",
        pricingMode: pkg?.pricing_mode ?? "cycle",
        billingCycle: pkg?.billing_period ?? null,
        sessionsIncluded: u ? Number(u.sessions_included) : null,
        sessionsUsed: u ? Number(u.sessions_used) : null,
        sessionsRemaining: u ? Number(u.sessions_remaining) : null,
      };
    }),
    invoices: (invoices ?? []).map((i) => ({
      id: i.id as string,
      amount: Number(i.amount),
      status: i.status as string,
      dueDate: i.due_date as string,
      periodStart: i.period_start as string,
      periodEnd: i.period_end as string,
      paidAt: (i.paid_at as string | null) ?? null,
    })),
    classes: (bookings ?? [])
      .map((b) => {
        const c = b.classes as unknown as {
          id: string;
          start_time: string;
          end_time: string;
          locations: { name: string } | null;
          class_types: { name: string } | null;
        };
        return {
          id: c.id,
          startTime: c.start_time,
          endTime: c.end_time,
          locationName: c.locations?.name ?? "-",
          classTypeName: c.class_types?.name ?? "-",
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    promos: (promos ?? []).map((p) => ({
      id: p.id as string,
      title: p.title as string,
      body: p.body as string,
      imageUrl: (p.image_url as string | null) ?? null,
    })),
  };
}
