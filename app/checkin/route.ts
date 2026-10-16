import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guard";
import { createSession, getSession, getSessionToken } from "@/lib/auth/session";
import { isKeyRateLimited } from "@/lib/auth/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createSupabaseClientWithToken } from "@/lib/supabase/server";
import { listMemberClubs } from "@/lib/data/member-clubs";
import { CHECKIN_ERROR_CODES } from "@/lib/checkin";

const SCAN_LIMIT = 10;
const SCAN_WINDOW_SECONDS = 60;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const pointId = params.get("p") ?? "";
  const token = params.get("t") ?? "";

  const result = (code: string, extra: Record<string, string> = {}) =>
    NextResponse.redirect(new URL(`/checkin/hasil?${new URLSearchParams({ r: code, ...extra })}`, request.url));

  if (!z.string().uuid().safeParse(pointId).success || !/^[0-9a-f]{12}$/.test(token)) {
    return result("CK005");
  }

  const session = await getSession();
  if (!session) {
    const next = `/checkin?${new URLSearchParams({ p: pointId, t: token })}`;
    return NextResponse.redirect(new URL(`/login?${new URLSearchParams({ next })}`, request.url));
  }
  if (session.app_role !== "member") return result("STAFF");

  await requireRole("member");

  const admin = createAdminSupabaseClient();
  const { data: point } = await admin
    .from("checkin_points")
    .select("tenant_id, is_active")
    .eq("id", pointId)
    .maybeSingle();
  if (!point?.is_active) return result("CK005");

  let profileId = session.sub;
  let sessionToken = await getSessionToken();

  if (point.tenant_id !== session.tenant_id || session.club_pending) {
    const { data: own } = await admin
      .from("profiles")
      .select("member_account_id")
      .eq("id", session.sub)
      .maybeSingle();
    const clubs = own?.member_account_id ? await listMemberClubs(own.member_account_id) : [];
    const club = clubs.find((c) => c.tenantId === point.tenant_id);
    if (!club) return result("NOT_MEMBER");
    sessionToken = await createSession({
      id: club.profileId,
      accountId: session.account_id,
      email: club.email,
      fullName: club.fullName,
      role: "member",
      tenantId: club.tenantId,
      orgId: club.orgId,
    });
    profileId = club.profileId;
  }

  if (await isKeyRateLimited(`checkin:${profileId}`, SCAN_LIMIT, SCAN_WINDOW_SECONDS)) return result("RATE");

  const { data, error } = await createSupabaseClientWithToken(sessionToken).rpc("record_checkin", {
    p_point_id: pointId,
    p_token: token,
  });
  if (error) return result(CHECKIN_ERROR_CODES.has(error.code) ? error.code : "ERROR");

  const row = (data as { out_checkin_id: string; out_already: boolean }[] | null)?.[0];
  if (!row) return result("ERROR");
  return result("OK", { c: row.out_checkin_id, a: row.out_already ? "1" : "0" });
}
