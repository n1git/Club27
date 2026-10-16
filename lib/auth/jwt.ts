import { SignJWT, jwtVerify } from "jose";
import type { AppRole } from "./roles";

export type SessionContext = "personal" | "member" | "org";

export interface SessionClaims {
  sub: string;
  role: "authenticated";
  app_role: AppRole;
  tenant_id: string;
  org_id: string;
  club_pending?: boolean;
  ctx: SessionContext;
  account_id: string;
  email: string;
  full_name: string;
  iat?: number;
}

const SESSION_DURATION = "7d";

function getSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  claims: Omit<SessionClaims, "role">
): Promise<string> {
  return new SignJWT({ ...claims, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifySession(
  token: string
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}
