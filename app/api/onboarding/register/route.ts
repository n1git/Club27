import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { serverQuote } from "@/lib/data/platform-pricing";
import { registerClubSchema } from "@/lib/validations/onboarding";
import { clientIp, isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";
import { verifyCaptcha } from "@/lib/captcha";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";
import { APP_NAME } from "@/lib/config";
import { createAccount, discardUnusedAccount } from "@/lib/accounts/account";
import { CONSENT_VERSION } from "@/lib/consent";

const GENERIC_ERROR = "Pendaftaran tidak dapat diproses. Periksa data Anda atau masuk jika sudah punya akun.";

function verificationEmail(link: string, name: string) {
  return {
    subject: `Verifikasi email pendaftaran ${APP_NAME}`,
    text: `Halo ${name},\n\nBuka tautan ini dalam 24 jam untuk menyelesaikan pendaftaran klub Anda:\n${link}\n\nAbaikan email ini jika Anda tidak mendaftar.`,
    html: `<p>Halo ${escapeHtml(name)},</p><p>Buka tautan ini dalam 24 jam untuk menyelesaikan pendaftaran klub Anda:</p><p><a href="${link}">${link}</a></p><p>Abaikan email ini jika Anda tidak mendaftar.</p>`,
  };
}

function existingAccountEmail() {
  const link = `${SITE_URL}/login`;
  return {
    subject: `Email Anda sudah terdaftar di ${APP_NAME}`,
    text: `Seseorang mencoba mendaftarkan klub baru dengan email ini, tetapi email ini sudah terdaftar. Masuk di ${link}. Abaikan email ini jika bukan Anda.`,
    html: `<p>Seseorang mencoba mendaftarkan klub baru dengan email ini, tetapi email ini sudah terdaftar.</p><p>Masuk di <a href="${link}">${link}</a>. Abaikan email ini jika bukan Anda.</p>`,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

type Created = { organization_id: string; club_id: string; owner_id: string; profile_id: string };

async function recordOwnerConsent(created: Created) {
  await createAdminSupabaseClient().from("consents").insert({
    club_id: created.club_id,
    organization_id: created.organization_id,
    subject_type: "owner",
    subject_id: created.owner_id,
    kind: "terms_privacy",
    version: CONSENT_VERSION,
  });
}

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  }
  if (await isRateLimited(request, "register", 5, 3600, true)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const body = await readJsonBody(request);
  const parsed = registerClubSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: body === null ? "Data pendaftaran tidak valid" : (parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid") },
      { status: 400 }
    );
  }
  const { tenantName, ownerFullName, ownerEmail, username, password, planCode, billingPeriod, estimatedUsers, clubType } = parsed.data;

  if (!(await verifyCaptcha((body as { captchaToken?: unknown }).captchaToken, clientIp(request)))) {
    return NextResponse.json({ error: "Verifikasi keamanan gagal. Muat ulang halaman lalu coba lagi." }, { status: 400 });
  }

  const quote = await serverQuote(planCode, billingPeriod, estimatedUsers);
  if (!quote) {
    return NextResponse.json({ error: "Paket tidak tersedia" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const verifyByEmail = isEmailConfigured();
  if (verifyByEmail) await supabase.rpc("discard_unverified_registration", { p_email: ownerEmail });

  const account = await createAccount({
    email: ownerEmail,
    username,
    fullName: ownerFullName,
    passwordHash: await hashPassword(password),
    emailVerified: !verifyByEmail,
  });
  if (!account.ok) {
    if (account.field === "username") {
      return NextResponse.json({ error: account.error, field: "username" }, { status: 409 });
    }
    if (account.field === "email") {
      if (verifyByEmail) {
        await sendEmail({ to: ownerEmail, ...existingAccountEmail() });
        return NextResponse.json({ status: "check_email", quote }, { status: 202 });
      }
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    return NextResponse.json({ error: "Gagal mendaftarkan klub. Coba lagi nanti." }, { status: 500 });
  }

  const args = {
    p_organization_name: tenantName,
    p_club_name: tenantName,
    p_account_id: account.id,
    p_plan: planCode,
    p_period: billingPeriod,
    p_club_type: clubType,
  };
  const failure = async (message: string | undefined) => {
    await discardUnusedAccount(account.id);
    if (message?.includes("club type not available") || message?.includes("plan not available")) {
      return NextResponse.json({ error: "Paket atau jenis klub tidak tersedia" }, { status: 400 });
    }
    return null;
  };

  if (verifyByEmail) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data, error } = await supabase.rpc("register_organization_unverified", { ...args, p_token_hash: tokenHash });
    const pending = (data as Created[] | null)?.[0];
    if (error || !pending) {
      const known = await failure(error?.message);
      return known ?? NextResponse.json({ error: "Gagal mendaftarkan klub. Coba lagi nanti." }, { status: 500 });
    }
    await recordOwnerConsent(pending);
    await sendEmail({ to: ownerEmail, ...verificationEmail(`${SITE_URL}/api/onboarding/verify?token=${token}`, ownerFullName) });
    return NextResponse.json({ status: "check_email", quote }, { status: 202 });
  }

  const { data, error } = await supabase.rpc("register_organization", args);
  const created = (data as Created[] | null)?.[0];
  if (error || !created) {
    const known = await failure(error?.message);
    return known ?? NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  await recordOwnerConsent(created);
  await createSession({
    id: created.profile_id,
    accountId: account.id,
    email: ownerEmail,
    fullName: ownerFullName,
    role: "owner",
    tenantId: created.club_id,
    orgId: created.organization_id,
  });

  return NextResponse.json({ redirectTo: "/admin/onboarding", quote });
}
