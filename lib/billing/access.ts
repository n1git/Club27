import { getJakartaDateString } from "@/lib/format";

export interface BillingState {
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_days: number;
}

export type BillingPhase = "trial" | "active" | "grace" | "ended" | "pending" | "unverified" | "suspended";

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function lapsedDate(state: BillingState): string | null {
  if (state.status === "trial" || state.status === "active") {
    return state.status === "trial" ? state.trial_ends_at : state.current_period_end;
  }
  if (state.status === "expired") return state.current_period_end ?? state.trial_ends_at;
  return null;
}

export function graceEndsOn(state: BillingState): string | null {
  const lapsed = lapsedDate(state);
  return lapsed ? addDays(lapsed, state.grace_days) : null;
}

export function billingPhase(state: BillingState | null, today: string = getJakartaDateString()): BillingPhase {
  if (!state) return "active";
  switch (state.status) {
    case "pending_verification":
      return "unverified";
    case "pending":
      return "pending";
    case "suspended":
    case "cancelled":
      return "suspended";
    case "trial":
      if (!state.trial_ends_at || state.trial_ends_at >= today) return "trial";
      break;
    case "active":
      if (!state.current_period_end || state.current_period_end >= today) return "active";
      break;
  }
  const lapsed = lapsedDate(state);
  if (lapsed && today <= addDays(lapsed, state.grace_days)) return "grace";
  return "ended";
}

export function isReadOnlyPhase(phase: BillingPhase) {
  return phase === "grace";
}

export function isLockedPhase(phase: BillingPhase) {
  return phase === "ended" || phase === "pending" || phase === "unverified";
}

export const BILLING_OPEN_PATHS = ["/admin/klub/langganan", "/admin/klub/ekspor", "/admin/profile"];
