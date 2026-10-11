import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { APP_ROLES, canAccessPath, roleHome, type AppRole } from "@/lib/auth/roles";

const COOKIE_NAME = "app_session";
const SUPERADMIN_COOKIE_NAME = "superadmin_session";
const SUPERADMIN_AUDIENCE = "club27-superadmin";
const PROTECTED_PREFIXES = ["/admin", "/coach", "/member", "/change-password", "/profile"];
const GUEST_ONLY_PREFIXES = ["/login", "/daftar"];

function getSecret() {
  return new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
}

async function readAppRole(request: NextRequest): Promise<AppRole | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.app_role as AppRole;
    return APP_ROLES.includes(role) ? role : null;
  } catch {
    return null;
  }
}

async function hasSuperadminSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SUPERADMIN_COOKIE_NAME)?.value;
  const secret = process.env.SUPERADMIN_JWT_SECRET;
  if (!token || !secret) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { audience: SUPERADMIN_AUDIENCE });
    return payload.superadmin === true && typeof payload.sid === "string";
  } catch {
    return false;
  }
}

function contentSecurityPolicy(nonce: string) {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${supabase}`.trim(),
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withCsp(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    if (pathname === "/superadmin/login" || (await hasSuperadminSession(request))) {
      return withCsp(request);
    }
    return NextResponse.redirect(new URL("/superadmin/login", request.url));
  }

  const appRole = await readAppRole(request);

  if (PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && !appRole) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (GUEST_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && appRole) {
    return NextResponse.redirect(new URL(roleHome(appRole), request.url));
  }

  if (appRole && !canAccessPath(appRole, pathname)) {
    return NextResponse.redirect(new URL(roleHome(appRole), request.url));
  }

  return withCsp(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
