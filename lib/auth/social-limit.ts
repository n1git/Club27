import { isKeyRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { socialBlocked } from "@/lib/auth/social-access";
import type { ActionState } from "@/lib/actions/types";

export async function socialLimited(accountId: string, scope: string, limit: number, windowSeconds = 3600): Promise<ActionState | null> {
  if (scope !== "workout") {
    const blocked = await socialBlocked(accountId);
    if (blocked) return blocked;
  }
  return (await isKeyRateLimited(`social:${scope}:${accountId}`, limit, windowSeconds, true)) ? { ok: false, error: RATE_LIMIT_ERROR } : null;
}
