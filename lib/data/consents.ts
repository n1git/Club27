import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface AccountConsent {
  kind: string;
  version: string;
  acceptedAt: string;
  revokedAt: string | null;
}

export async function getAccountConsents(accountId: string): Promise<AccountConsent[]> {
  const { data } = await createAdminSupabaseClient()
    .from("consents")
    .select("kind, version, accepted_at, revoked_at")
    .eq("subject_type", "account")
    .eq("subject_id", accountId)
    .order("accepted_at", { ascending: false });
  return (data ?? []).map((r) => ({
    kind: r.kind as string,
    version: r.version as string,
    acceptedAt: r.accepted_at as string,
    revokedAt: (r.revoked_at as string | null) ?? null,
  }));
}

export async function activeHealthConsent(accountId: string): Promise<AccountConsent | null> {
  return (await getAccountConsents(accountId)).find((c) => c.kind === "health_data" && !c.revokedAt) ?? null;
}
