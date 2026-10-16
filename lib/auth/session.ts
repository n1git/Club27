import { cookies } from "next/headers";
import { signSession, verifySession, type SessionClaims, type SessionContext } from "./jwt";
import type { AppRole } from "./roles";

const COOKIE_NAME = "app_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function contextOf(role: AppRole): SessionContext {
  return role === "personal" ? "personal" : role === "member" ? "member" : "org";
}

export async function createSession(user: {
  id: string;
  accountId: string;
  email: string;
  fullName: string;
  role: AppRole;
  tenantId: string;
  orgId: string;
  clubPending?: boolean;
}): Promise<string> {
  const token = await signSession({
    sub: user.id,
    ctx: contextOf(user.role),
    account_id: user.accountId,
    app_role: user.role,
    tenant_id: user.tenantId,
    org_id: user.orgId,
    ...(user.clubPending ? { club_pending: true } : {}),
    email: user.email,
    full_name: user.fullName,
  });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return token;
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}

export async function getSession(): Promise<SessionClaims | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return verifySession(token);
}
