import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { verifyPasswordOrDummy } from "@/lib/auth/password";
import { startSuperadminChallenge } from "@/lib/auth/superadmin";
import { generateTotpSecret, otpauthUri, sealSecret } from "@/lib/auth/totp";
import { superadminLoginSchema, LOGIN_ERROR } from "@/lib/validations/auth";
import { clientIp, isKeyLocked, isRateLimited, recordFailure, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { APP_NAME } from "@/lib/config";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";

const FAIL_LIMIT = 5;
const FAIL_WINDOW = 900;
const GENERIC_ERROR = LOGIN_ERROR;

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  }
  if (await isRateLimited(request, "superadmin-login", 10, 900, true)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await readJsonBody(request);
  const parsed = superadminLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }
  const { identifier } = parsed.data;

  const supabase = createAdminSupabaseClient();
  const { data: superadmin } = await supabase
    .from("superadmins")
    .select("id, email, password_hash, is_active, totp_enabled_at")
    .eq(identifier.field, identifier.value)
    .maybeSingle();
  const failKey = `superadmin-fail:${clientIp(request)}:${superadmin?.email ?? identifier.value}`;
  const locked = await isKeyLocked(failKey, FAIL_LIMIT, FAIL_WINDOW);

  const valid = await verifyPasswordOrDummy(parsed.data.password, superadmin?.password_hash);
  if (!superadmin || !superadmin.is_active || locked || !valid) {
    if (!locked) await recordFailure(failKey, FAIL_WINDOW);
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
  }

  await startSuperadminChallenge(superadmin.id);

  if (superadmin.totp_enabled_at) {
    return NextResponse.json({ step: "totp" });
  }

  const secret = generateTotpSecret();
  await supabase.from("superadmins").update({ totp_pending_secret: sealSecret(secret) }).eq("id", superadmin.id);
  return NextResponse.json({ step: "enroll", secret, uri: otpauthUri(superadmin.email, secret, APP_NAME) });
}
