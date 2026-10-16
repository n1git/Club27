export type AppRole = "admin" | "coach" | "receptionist" | "finance" | "member" | "personal";

export const APP_ROLES: AppRole[] = ["admin", "coach", "receptionist", "finance", "member", "personal"];

export const PERSONAL_HOME = "/akun";

export const STAFF_ROLES = ["admin", "receptionist", "finance"] as const satisfies readonly AppRole[];

export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  coach: "Pelatih",
  receptionist: "Resepsionis",
  finance: "Keuangan",
  member: "Anggota",
  personal: "Akun",
};

export const OWNER_HOME = "/admin/klub";

export function roleHome(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "coach":
      return "/coach";
    case "receptionist":
      return "/admin/schedule";
    case "finance":
      return "/admin/billing/invoices";
    case "member":
      return "/member";
    case "personal":
      return PERSONAL_HOME;
  }
}

export function profilePath(role: AppRole): string {
  if (role === "coach") return "/coach/profile";
  if (role === "member") return "/member/profile";
  if (role === "personal") return PERSONAL_HOME;
  return "/admin/profile";
}

const ADMIN_SECTION_ACCESS: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/admin/profile", roles: ["admin", "receptionist", "finance"] },
  { prefix: "/admin/members", roles: ["admin", "receptionist"] },
  { prefix: "/admin/kasir", roles: ["admin", "receptionist"] },
  { prefix: "/admin/pesanan", roles: ["admin", "receptionist", "finance"] },
  { prefix: "/admin/booking", roles: ["admin", "receptionist"] },
  { prefix: "/admin/schedule/new", roles: ["admin"] },
  { prefix: "/admin/schedule", roles: ["admin", "receptionist"] },
  { prefix: "/admin/billing/invoices", roles: ["admin", "finance", "receptionist"] },
  { prefix: "/admin/billing", roles: ["admin", "finance"] },
  { prefix: "/admin/cash-ledger", roles: ["admin", "finance"] },
  { prefix: "/admin/payroll", roles: ["admin", "finance"] },
  { prefix: "/admin/reports", roles: ["admin", "finance"] },
];

function underPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canAccessPath(role: AppRole, pathname: string): boolean {
  if (underPath(pathname, "/member")) return role === "member";
  if (underPath(pathname, "/coach")) return role === "coach";
  if (underPath(pathname, PERSONAL_HOME)) return role === "personal";
  if (!underPath(pathname, "/admin")) return true;
  if (role === "admin") return true;
  const rule = ADMIN_SECTION_ACCESS.find((r) => underPath(pathname, r.prefix));
  return rule ? rule.roles.includes(role) : false;
}
