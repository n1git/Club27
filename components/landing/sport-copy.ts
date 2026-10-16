import type { PublicClubType } from "@/lib/club-type";

export function describe(t: PublicClubType, ready: Set<string>): string {
  const has = (code: string) => t.modules.includes(code) && ready.has(code);
  const parts = [`${t.terms.member} dan ${t.terms.coach.toLowerCase()}`];
  if (has("classes")) parts.push(`jadwal ${t.terms.session.toLowerCase()}`);
  if (has("resource_booking")) parts.push(`booking ${t.terms.resource.toLowerCase()}`);
  if (has("checkin")) parts.push("check-in QR");
  if (has("pos")) parts.push("kasir");
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, dan ${parts[parts.length - 1]}` : parts[0];
}
