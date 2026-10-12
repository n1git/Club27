import { getJakartaDateString } from "@/lib/format";

export interface BillingState {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
}

export function isBillingLocked(state: BillingState | null, today: string = getJakartaDateString()): boolean {
  if (!state) return false;
  if (state.status === "pending" || state.status === "expired") return true;
  if (state.status === "trial") return Boolean(state.trial_ends_at && state.trial_ends_at < today);
  if (state.status === "active") return Boolean(state.current_period_end && state.current_period_end < today);
  return false;
}

export const BILLING_OPEN_PATHS = ["/admin/klub/langganan", "/admin/profile"];
