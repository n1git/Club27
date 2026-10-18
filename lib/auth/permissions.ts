export const PERMISSION_CODES = [
  "dashboard.view",
  "members.view_all",
  "members.view_assigned",
  "members.create",
  "members.update_all",
  "members.change_status",
  "members.edit_notes_assigned",
  "members.edit_notes_all",
  "members.reassign_coach",
  "members.delete",
  "members.consent",
  "members.privacy",
  "members.portal",
  "members.lookup",
  "schedule.view",
  "schedule.manage",
  "schedule.set_substitute",
  "classes.instruct",
  "teaching.portal",
  "bookings.view_all",
  "bookings.view_assigned",
  "bookings.manage_all",
  "bookings.manage_assigned",
  "bookings.override_rules",
  "checkin.view_all",
  "checkin.view_assigned",
  "checkin.manage",
  "checkin.record_all",
  "checkin.record_assigned",
  "coaches.view",
  "coaches.manage",
  "staff.view",
  "staff.manage",
  "invoices.view",
  "invoices.collect",
  "invoices.manage",
  "packages.manage",
  "subscriptions.view",
  "subscriptions.manage",
  "cash_ledger.view",
  "cash_ledger.manage",
  "payroll.view",
  "payroll.manage",
  "reports.view",
  "pos.sell",
  "pos.orders_view",
  "pos.products_manage",
  "pos.void_paid",
  "resources.manage",
  "resource_bookings.view",
  "resource_bookings.manage",
  "promo.manage",
  "club.settings",
  "audit.view",
  "billing.view",
  "billing.manage",
  "roles.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];

export type PermissionSet = ReadonlySet<string>;

export function hasAny(permissions: PermissionSet, codes: PermissionCode | readonly PermissionCode[]): boolean {
  const list = typeof codes === "string" ? [codes] : codes;
  return list.some((code) => permissions.has(code));
}

const ADMIN_PATH_RULES: { prefix: string; any: readonly PermissionCode[] }[] = [
  { prefix: "/admin/join-requests", any: ["members.create"] },
  { prefix: "/admin/members", any: ["members.view_all"] },
  { prefix: "/admin/pos", any: ["pos.sell"] },
  { prefix: "/admin/orders", any: ["pos.orders_view"] },
  { prefix: "/admin/booking", any: ["resource_bookings.view"] },
  { prefix: "/admin/schedule/new", any: ["schedule.manage"] },
  { prefix: "/admin/schedule", any: ["schedule.view"] },
  { prefix: "/admin/billing/invoices", any: ["invoices.view"] },
  { prefix: "/admin/billing", any: ["packages.manage", "subscriptions.view", "invoices.manage"] },
  { prefix: "/admin/cash-ledger", any: ["cash_ledger.view"] },
  { prefix: "/admin/payroll", any: ["payroll.view"] },
  { prefix: "/admin/reports", any: ["reports.view"] },
  { prefix: "/admin/coaches", any: ["coaches.manage"] },
  { prefix: "/admin/staff", any: ["staff.manage"] },
  { prefix: "/admin/checkin", any: ["checkin.manage"] },
  { prefix: "/admin/audit", any: ["audit.view"] },
  { prefix: "/admin/products", any: ["pos.products_manage"] },
  { prefix: "/admin/facilities", any: ["resources.manage"] },
  { prefix: "/admin/onboarding", any: ["club.settings"] },
  { prefix: "/admin/promo", any: ["promo.manage"] },
  { prefix: "/admin/settings", any: ["club.settings"] },
  { prefix: "/admin/roles", any: ["roles.manage"] },
];

const OWNER_ONLY_PREFIXES = ["/admin/club"];

const BILLING_PREFIX = "/admin/club/subscription";

const FREE_PREFIXES = ["/profile"];

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function adminPathAllowed(isOwner: boolean, permissions: PermissionSet, pathname: string): boolean {
  if (FREE_PREFIXES.some((p) => under(pathname, p))) return true;
  if (under(pathname, BILLING_PREFIX)) return isOwner || hasAny(permissions, "billing.view");
  if (OWNER_ONLY_PREFIXES.some((p) => under(pathname, p))) return isOwner;
  const rule = ADMIN_PATH_RULES.find((r) => under(pathname, r.prefix));
  return hasAny(permissions, rule ? rule.any : ["dashboard.view"]);
}

export const ADMIN_AREA_PERMISSIONS: readonly PermissionCode[] = [
  "dashboard.view",
  "members.view_all",
  "pos.sell",
  "pos.orders_view",
  "resource_bookings.view",
  "schedule.view",
  "invoices.view",
  "packages.manage",
  "subscriptions.view",
  "cash_ledger.view",
  "payroll.view",
  "reports.view",
  "staff.manage",
  "coaches.manage",
  "checkin.manage",
  "audit.view",
  "pos.products_manage",
  "resources.manage",
  "promo.manage",
  "club.settings",
  "billing.view",
  "roles.manage",
];

const HOME_RULES: { permission: PermissionCode; href: string }[] = [
  { permission: "dashboard.view", href: "/admin" },
  { permission: "teaching.portal", href: "/coach" },
  { permission: "schedule.view", href: "/admin/schedule" },
  { permission: "invoices.view", href: "/admin/billing/invoices" },
  { permission: "pos.sell", href: "/admin/pos" },
  { permission: "members.view_all", href: "/admin/members" },
  { permission: "cash_ledger.view", href: "/admin/cash-ledger" },
  { permission: "payroll.view", href: "/admin/payroll" },
  { permission: "pos.orders_view", href: "/admin/orders" },
];

export function staffHome(permissions: PermissionSet): string {
  return HOME_RULES.find((r) => permissions.has(r.permission))?.href ?? "/profile";
}
