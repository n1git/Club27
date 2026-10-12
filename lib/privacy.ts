import { getJakartaDateString } from "@/lib/format";

export const PRIVACY_VERSION = "2026-10-12";

export function isMinor(dateOfBirth: string, today: string = getJakartaDateString()): boolean {
  const [by, bm, bd] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  if (!by || !ty) return false;
  const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
  return age < 18;
}
