export type AppRole = "owner" | "staff" | "member" | "personal";

export const APP_ROLES: AppRole[] = ["owner", "staff", "member", "personal"];

export const OWNER_HOME = "/admin/club";

export const PERSONAL_HOME = "/home";

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

function underPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessPath(role: AppRole, pathname: string): boolean {
  if (underPath(pathname, "/member")) return role === "member";
  if (underPath(pathname, PERSONAL_HOME)) return role === "personal";
  if (underPath(pathname, "/coach") || underPath(pathname, "/admin")) return role === "owner" || role === "staff";
  return true;
}
