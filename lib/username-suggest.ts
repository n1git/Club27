export const RESERVED_USERNAMES = new Set([
  "admin", "coach", "member", "superadmin", "api", "login", "signup", "profile", "privacy", "terms", "checkin",
  "home", "invite", "sports", "p", "s", "g", "c", "i", "r", "workouts", "friends", "groups", "challenges", "health",
  "settings", "upgrade", "join", "daftar", "akun", "olahraga", "privasi", "syarat", "undangan",
  "robots.txt", "sitemap.xml", "favicon.ico", "icon.svg", "apple-icon.png", "opengraph-image",
  "www", "app", "help", "support", "root", "system", "ruzz", "club27",
  "about", "blog", "contact", "docs", "explore", "pricing", "search", "status", "static", "public", "assets",
  "me", "new", "edit", "delete", "official", "staff", "team", "info", "mail", "email", "webmaster", "postmaster",
  "null", "undefined", "notifications", "messages", "stories",
]);
export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/;

export function suggestUsername(email: string, allowReserved = false): string {
  let base = (email.split("@")[0] ?? "").toLowerCase().replace(/[^a-z0-9._]/g, "");
  if (!/^[a-z]/.test(base)) base = `u${base}`;
  base = base.slice(0, 30).padEnd(3, "0");
  return !allowReserved && RESERVED_USERNAMES.has(base) ? `${base}2` : base;
}
