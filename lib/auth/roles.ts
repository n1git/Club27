export type AppRole = "owner" | "staff" | "member" | "personal";

export const APP_ROLES: AppRole[] = ["owner", "staff", "member", "personal"];

export const OWNER_HOME = "/admin/club";

export const PERSONAL_HOME = "/";

export const PERSONAL_PATHS = ["/workouts", "/friends", "/groups", "/challenges", "/health", "/settings", "/upgrade", "/join", "/g", "/c", "/p"];

export function roleHome(role: AppRole, staffHome = "/admin"): string {
  switch (role) {
    case "owner":
      return OWNER_HOME;
    case "staff":
      return staffHome;
    case "member":
      return "/member";
    case "personal":
      return PERSONAL_HOME;
  }
}

export function underPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPersonalPath(pathname: string): boolean {
  return PERSONAL_PATHS.some((prefix) => underPath(pathname, prefix));
}

export function canAccessPath(role: AppRole, pathname: string): boolean {
  if (underPath(pathname, "/member")) return role === "member";
  if (isPersonalPath(pathname)) return role === "personal";
  if (underPath(pathname, "/coach") || underPath(pathname, "/admin")) return role === "owner" || role === "staff";
  return true;
}
