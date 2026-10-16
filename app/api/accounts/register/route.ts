import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { PERSONAL_HOME } from "@/lib/auth/roles";
import { registerAccountSchema } from "@/lib/validations/auth";
import { clientIp, isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";
import { verifyCaptcha } from "@/lib/captcha";
import { createAccount } from "@/lib/accounts/account";
import { PRIVACY_VERSION } from "@/lib/privacy";

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  }
  if (await isRateLimited(request, "register-account", 5, 3600, true)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await readJsonBody(request);
  const parsed = registerAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: body === null ? "Data pendaftaran tidak valid" : (parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid") },
      { status: 400 }
    );
  }
  const { fullName, email, username, password } = parsed.data;

  if (!(await verifyCaptcha((body as { captchaToken?: unknown }).captchaToken, clientIp(request)))) {
    return NextResponse.json({ error: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." }, { status: 400 });
  }

  const account = await createAccount({ email, username, fullName, passwordHash: await hashPassword(password) });
  if (!account.ok) {
    if (account.field === "username") {
      return NextResponse.json({ error: account.error, field: "username" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Pendaftaran tidak dapat diproses. Periksa data Anda atau masuk jika sudah punya akun." },
      { status: 400 }
    );
  }

  await createAdminSupabaseClient().from("consents").insert({
    subject_type: "account",
    subject_id: account.id,
    kind: "terms_privacy",
    version: PRIVACY_VERSION,
  });

  await createSession({
    id: account.id,
    accountId: account.id,
    email,
    fullName,
    role: "personal",
    tenantId: "",
    orgId: "",
  });

  return NextResponse.json({ redirectTo: PERSONAL_HOME });
}
