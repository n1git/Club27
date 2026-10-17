import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getJakartaDateString, getJakartaDayRangeIso } from "@/lib/format";

export interface DashboardData {
  totalRevenue: number;
  outstandingCount: number;
  outstandingAmount: number;
  totalPayrollCost: number;
  activeMembers: number;
  inactiveMembers: number;
  cashBalance: number;
  activePromoCount: number;
  todaysClasses: {
    id: string;
    startTime: string;
    endTime: string;
    coachName: string;
    locationName: string;
    classTypeName: string;
    bookedCount: number;
    capacity: number;
  }[];
  expiringSubscriptions: {
    id: string;
    memberName: string;
    packageName: string;
    endDate: string;
  }[];
  overdueInvoices: {
    id: string;
    memberName: string;
    amount: number;
    dueDate: string;
  }[];
  revenueDelta: number | null;
  balanceDelta: number | null;
  revenueSpark: number[];
  balanceSpark: number[];
  recentCashEntries: {
    id: string;
    entryDate: string;
    category: string;
    direction: "in" | "out";
    amount: number;
  }[];
}

const SPARK_DAYS = 14;

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createServerSupabaseClient();
  const today = getJakartaDateString();
  const { start: todayStart, end: todayEnd } = getJakartaDayRangeIso();
  const in7Days = getJakartaDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

  const sparkDays = Array.from({ length: SPARK_DAYS }, (_, i) =>
    getJakartaDateString(new Date(Date.now() - (SPARK_DAYS - 1 - i) * 86400000)),
  );
  const sparkStartIso = getJakartaDayRangeIso(new Date(`${sparkDays[0]}T12:00:00+07:00`)).start;

  const [
    { data: revenue },
    { data: outstanding },
    { data: payrollCost },
    { data: memberCounts },
    { data: cashEntries },
    { count: promoCount },
    { data: todaysClasses },
    { data: expiringSubs },
    { data: overdueInvoices },
    { data: paidInvoices },
    { data: ledgerWindow },
    { data: ledgerBefore },
  ] = await Promise.all([
    supabase.from("report_revenue").select("revenue"),
    supabase.from("report_outstanding").select("outstanding_count, outstanding_amount").maybeSingle(),
    supabase.from("report_payroll_cost").select("payroll_cost"),
    supabase.from("report_member_counts").select("active_members, inactive_members").maybeSingle(),
    supabase
      .from("cash_ledger_with_balance")
      .select("id, entry_date, category, direction, amount, running_balance")
      .order("entry_date", { ascending: false })
      .limit(5),
    supabase
      .from("promos")
      .select("id", { count: "exact", head: true })
      .lte("active_from", new Date().toISOString())
      .or(`active_until.is.null,active_until.gte.${new Date().toISOString()}`),
    supabase
      .from("classes")
      .select("id, start_time, end_time, capacity, profiles:club_profiles!classes_instructor_id_fkey(full_name), locations(name), class_types(name), bookings:class_bookings(id)")
      .gte("start_time", todayStart)
      .lt("start_time", todayEnd)
      .order("start_time"),
    supabase
      .from("member_memberships")
      .select("id, end_date, members:club_members(full_name), membership_packages(name)")
      .eq("status", "active")
      .gte("end_date", today)
      .lte("end_date", in7Days)
      .order("end_date"),
    supabase
      .from("invoices")
      .select("id, amount, due_date, members:club_members(full_name)")
      .eq("status", "outstanding")
      .lt("due_date", today)
      .order("due_date")
      .limit(20),
    supabase.from("invoices").select("amount, paid_at").eq("status", "paid").gte("paid_at", sparkStartIso),
    supabase
      .from("cash_ledger_with_balance")
      .select("entry_date, running_balance")
      .gte("entry_date", sparkStartIso)
      .order("entry_date")
      .order("id"),
    supabase
      .from("cash_ledger_with_balance")
      .select("running_balance")
      .lt("entry_date", sparkStartIso)
      .order("entry_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1),
  ]);

  const totalRevenue = (revenue ?? []).reduce((sum, r) => sum + Number(r.revenue), 0);
  const totalPayrollCost = (payrollCost ?? []).reduce((sum, r) => sum + Number(r.payroll_cost), 0);

  const revenueByDay = new Map<string, number>();
  for (const inv of paidInvoices ?? []) {
    const day = getJakartaDateString(new Date(inv.paid_at));
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(inv.amount));
  }
  const lastBalanceByDay = new Map<string, number>();
  for (const row of ledgerWindow ?? []) {
    lastBalanceByDay.set(getJakartaDateString(new Date(row.entry_date)), Number(row.running_balance));
  }
  let carry = ledgerBefore?.[0] ? Number(ledgerBefore[0].running_balance) : 0;
  const balanceSpark: number[] = [];
  for (const day of sparkDays) {
    const v = lastBalanceByDay.get(day);
    if (v !== undefined) carry = v;
    balanceSpark.push(carry);
  }

  const pctChange = (now: number, before: number) =>
    before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : null;
  const revenueSeries = sparkDays.map((d) => revenueByDay.get(d) ?? 0);
  const half = SPARK_DAYS / 2;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

  return {
    revenueDelta: pctChange(sum(revenueSeries.slice(half)), sum(revenueSeries.slice(0, half))),
    balanceDelta: pctChange(balanceSpark[balanceSpark.length - 1], balanceSpark[0]),
    revenueSpark: sparkDays.map((d) => revenueByDay.get(d) ?? 0),
    balanceSpark,
    totalRevenue,
    outstandingCount: outstanding?.outstanding_count ?? 0,
    outstandingAmount: Number(outstanding?.outstanding_amount ?? 0),
    totalPayrollCost,
    activeMembers: memberCounts?.active_members ?? 0,
    inactiveMembers: memberCounts?.inactive_members ?? 0,
    cashBalance: Number(cashEntries?.[0]?.running_balance ?? 0),
    activePromoCount: promoCount ?? 0,
    todaysClasses: (todaysClasses ?? []).map((c) => {
      const row = c as unknown as {
        id: string;
        start_time: string;
        end_time: string;
        capacity: number;
        profiles: { full_name: string } | null;
        locations: { name: string } | null;
        class_types: { name: string } | null;
        bookings: { id: string }[];
      };
      return {
        id: row.id,
        startTime: row.start_time,
        endTime: row.end_time,
        coachName: row.profiles?.full_name ?? "-",
        locationName: row.locations?.name ?? "-",
        classTypeName: row.class_types?.name ?? "-",
        bookedCount: row.bookings?.length ?? 0,
        capacity: row.capacity,
      };
    }),
    expiringSubscriptions: (expiringSubs ?? []).map((s) => {
      const row = s as unknown as {
        id: string;
        end_date: string;
        members: { full_name: string } | null;
        membership_packages: { name: string } | null;
      };
      return {
        id: row.id,
        memberName: row.members?.full_name ?? "-",
        packageName: row.membership_packages?.name ?? "-",
        endDate: row.end_date,
      };
    }),
    overdueInvoices: (overdueInvoices ?? []).map((i) => {
      const row = i as unknown as {
        id: string;
        amount: number;
        due_date: string;
        members: { full_name: string } | null;
      };
      return {
        id: row.id,
        memberName: row.members?.full_name ?? "-",
        amount: Number(row.amount),
        dueDate: row.due_date,
      };
    }),
    recentCashEntries: (cashEntries ?? []).map((e) => ({
      id: e.id,
      entryDate: e.entry_date,
      category: e.category,
      direction: e.direction,
      amount: Number(e.amount),
    })),
  };
}
