import type { AppRole } from "@/types/db";
import { findProfileByEmail, getCredential } from "./db";

const SESSION_KEY = "swimma_mvp_session";

export interface Session {
  userId: string;
  role: AppRole;
  fullName: string;
}

export function login(email: string, password: string): { ok: true } | { ok: false; error: string } {
  const profile = findProfileByEmail(email.trim());
  if (!profile || !profile.isActive) {
    return { ok: false, error: "Email atau kata sandi salah" };
  }
  const credential = getCredential(profile.id);
  if (!credential || credential.password !== password) {
    return { ok: false, error: "Email atau kata sandi salah" };
  }
  const session: Session = { userId: profile.id, role: profile.role, fullName: profile.fullName };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { ok: true };
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  coach: "/coach",
  parent: "/parent",
};
