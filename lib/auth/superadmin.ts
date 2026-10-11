import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const SUPERADMIN_COOKIE_NAME = "superadmin_session";
export const SUPERADMIN_AUDIENCE = "27club-superadmin";
const CHALLENGE_COOKIE_NAME = "superadmin_mfa";
const CHALLENGE_AUDIENCE = "27club-superadmin-mfa";
const SESSION_SECONDS = 60 * 60 * 12;
const CHALLENGE_SECONDS = 60 * 10;

function getSecret() {
  const secret = process.env.SUPERADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPERADMIN_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function startSuperadminChallenge(superadminId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(superadminId)
    .setAudience(CHALLENGE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_SECONDS}s`)
    .sign(getSecret());
  (await cookies()).set(CHALLENGE_COOKIE_NAME, token, cookieOptions(CHALLENGE_SECONDS));
}

export async function readSuperadminChallenge(): Promise<string | null> {
  const token = (await cookies()).get(CHALLENGE_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: CHALLENGE_AUDIENCE });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function createSuperadminSession(superadminId: string) {
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000);
  const { data, error } = await createAdminSupabaseClient()
    .from("superadmin_sessions")
    .insert({ superadmin_id: superadminId, expires_at: expiresAt.toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error("Gagal membuat sesi");

  const token = await new SignJWT({ superadmin: true, sid: data.id })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(superadminId)
    .setAudience(SUPERADMIN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.delete(CHALLENGE_COOKIE_NAME);
  cookieStore.set(SUPERADMIN_COOKIE_NAME, token, cookieOptions(SESSION_SECONDS));
}

async function readSessionClaims(): Promise<{ sub: string; sid: string } | null> {
  const token = (await cookies()).get(SUPERADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: SUPERADMIN_AUDIENCE });
    if (payload.superadmin !== true || typeof payload.sub !== "string" || typeof payload.sid !== "string") return null;
    return { sub: payload.sub, sid: payload.sid };
  } catch {
    return null;
  }
}

export async function clearSuperadminSession() {
  const claims = await readSessionClaims();
  if (claims) {
    await createAdminSupabaseClient()
      .from("superadmin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", claims.sid)
      .is("revoked_at", null);
  }
  const cookieStore = await cookies();
  cookieStore.delete(SUPERADMIN_COOKIE_NAME);
  cookieStore.delete(CHALLENGE_COOKIE_NAME);
}

async function loadActiveSuperadmin() {
  const claims = await readSessionClaims();
  if (!claims) return null;

  const supabase = createAdminSupabaseClient();
  const [{ data: session }, { data }] = await Promise.all([
    supabase
      .from("superadmin_sessions")
      .select("id")
      .eq("id", claims.sid)
      .eq("superadmin_id", claims.sub)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
    supabase
      .from("superadmins")
      .select("id, email, full_name, is_active, totp_enabled_at")
      .eq("id", claims.sub)
      .maybeSingle(),
  ]);

  if (!session || !data || !data.is_active || !data.totp_enabled_at) return null;
  return { id: data.id as string, email: data.email as string, fullName: data.full_name as string };
}

export async function requireSuperadmin() {
  const superadmin = await loadActiveSuperadmin();
  if (!superadmin) redirect("/superadmin/login");
  return superadmin;
}

export async function requireSuperadminAction() {
  const superadmin = await loadActiveSuperadmin();
  if (!superadmin) throw new Error("Sesi admin platform tidak valid");
  return superadmin;
}
