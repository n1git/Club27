export type NavIconKey =
  | "dashboard"
  | "members"
  | "coaches"
  | "staff"
  | "schedule"
  | "booking"
  | "facility"
  | "checkin"
  | "cashier"
  | "orders"
  | "products"
  | "packages"
  | "subscriptions"
  | "invoices"
  | "ledger"
  | "payroll"
  | "promo"
  | "reports"
  | "settings"
  | "audit"
  | "club"
  | "orgBilling"
  | "home"
  | "visits"
  | "switchClub"
  | "profile";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
  exact?: boolean;
  primary?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function isNavActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  const exact = item.exact ?? item.href.split("/").length <= 2;
  return exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
