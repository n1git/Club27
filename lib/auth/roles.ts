export type AppRole = "owner" | "staff" | "member" | "personal";

export const APP_ROLES: AppRole[] = ["owner", "staff", "member", "personal"];

export const OWNER_HOME = "/admin/klub";

export const PERSONAL_HOME = "/akun";

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

export function profilePath(role: AppRole, teachingOnly = false): string {
  if (role === "member") return "/member/profile";
  if (role === "personal") return PERSONAL_HOME;
  return teachingOnly ? "/coach/profile" : "/admin/profile";
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
