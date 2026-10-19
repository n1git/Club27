export type BillingPeriod = "monthly" | "yearly";
export type PlanCode = "plus";

export const BILLING_PERIODS: BillingPeriod[] = ["monthly", "yearly"];
export const PLAN_CODES: PlanCode[] = ["plus"];

export interface PricingPlan {
  code: PlanCode;
  name: string;
  pricePerUserMonth: number;
  clubLimit: number | null;
  minSeats: number;
  trialDays: number;
  yearlyFreeMonths: number;
  graceDays: number;
}

export interface Quote {
  users: number;
  unitPrice: number;
  months: number;
  total: number;
  perMonth: number;
}

export function computeQuote(plan: PricingPlan, period: BillingPeriod, users: number): Quote {
  const count = Math.max(Math.floor(users) || 1, plan.minSeats);
  const months = period === "yearly" ? 12 - plan.yearlyFreeMonths : 1;
  const span = period === "yearly" ? 12 : 1;
  const raw = count * plan.pricePerUserMonth * months;
  return {
    users: count,
    unitPrice: plan.pricePerUserMonth,
    months,
    total: Math.round(raw * 100) / 100,
    perMonth: Math.round((raw / span) * 100) / 100,
  };
}

export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export const PERIOD_LABEL: Record<BillingPeriod, string> = {
  monthly: "Bulanan",
  yearly: "Tahunan",
};

export function trialLabel(days: number): string {
  return days > 0 && days % 30 === 0 ? `${days / 30} bulan` : `${days} hari`;
}

export function rupiahCompact(value: number): string {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}
