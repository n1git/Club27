import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSession } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/auth/rate-limit";

export async function GET(request: NextRequest) {
  const failed = NextResponse.redirect(new URL("/daftar?verifikasi=gagal", request.url));
  if (await isRateLimited(request, "verify", 20, 3600, true)) return failed;
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return failed;

  const { data } = await createAdminSupabaseClient().rpc("verify_registration", {
    p_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  const row = (data as { organization_id: string; club_id: string; profile_id: string; account_id: string; email: string; full_name: string }[] | null)?.[0];
  if (!row) return failed;

  await createSession({
    id: row.profile_id,
    accountId: row.account_id,
    email: row.email,
    fullName: row.full_name,
    role: "owner",
    tenantId: row.club_id,
    orgId: row.organization_id,
  });
  return NextResponse.redirect(new URL("/admin/onboarding", request.url));
}
