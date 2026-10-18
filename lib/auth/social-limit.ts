import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import type { ActionState } from "@/lib/actions/types";

export async function socialLimited(accountId: string, scope: string, limit: number, windowSeconds = 3600): Promise<ActionState | null> {
  return (await isKeyRateLimited(`social:${scope}:${accountId}`, limit, windowSeconds, true)) ? { ok: false, error: RATE_LIMIT_ERROR } : null;
}
