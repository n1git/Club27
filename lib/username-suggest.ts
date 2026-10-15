export const RESERVED_USERNAMES = new Set(["admin", "superadmin", "support", "root", "system", "club27"]);
export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/;

export function suggestUsername(email: string, allowReserved = false): string {
  let base = (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9._]/g, "");
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  base = base.slice(0, 30).padEnd(3, "0");
  return !allowReserved && RESERVED_USERNAMES.has(base) ? `${base}2` : base;
}
