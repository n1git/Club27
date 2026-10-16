import { loadRoleLabel, requireRole } from "@/lib/auth/guard";
import { adminPathAllowed } from "@/lib/auth/permissions";
import { getCurrentTenant } from "@/lib/data/tenant";
import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup, NavItem } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { loadOwner } from "@/lib/auth/owner";
import { getSwitchableTenants } from "@/lib/data/organization";
import { LazyTenantSwitcher } from "@/components/organization/lazy-tenant-switcher";
import { getEnabledModules } from "@/lib/modules";
import { getClubTerms } from "@/lib/club-type";
import { ReadOnlyBanner } from "@/components/subscription/read-only-banner";

type AdminNavItem = NavItem & { module?: string };
type AdminNavGroup = { label?: string; items: AdminNavItem[] };

const PRIMARY_OPERATIONS = ["/admin/schedule", "/admin/booking", "/admin/kasir", "/admin/checkin"];

const adminGroups = (resourceLabel: string): AdminNavGroup[] => [
  { label: "Utama", items: [{ href: "/admin", label: "Dasbor", icon: "dashboard", primary: true }] },
  {
    label: "Orang",
    items: [
      { href: "/admin/members", label: "Anggota", icon: "members", primary: true },
      { href: "/admin/coaches", label: "Pelatih", icon: "coaches" },
      { href: "/admin/staff", label: "Staf", icon: "staff" },
    ],
  },
  {
    label: "Operasional",
    items: [
      { href: "/admin/schedule", label: "Jadwal", icon: "schedule", module: "classes" },
      { href: "/admin/booking", label: "Booking", icon: "booking", module: "resource_booking" },
      { href: "/admin/fasilitas", label: resourceLabel, icon: "facility", module: "resource_booking" },
      { href: "/admin/checkin", label: "Check-in", icon: "checkin", module: "checkin" },
    ],
  },
  {
    label: "Penjualan",
    items: [
      { href: "/admin/kasir", label: "Kasir", icon: "cashier", module: "pos" },
      { href: "/admin/pesanan", label: "Pesanan", icon: "orders", module: "pos" },
      { href: "/admin/produk", label: "Produk", icon: "products", module: "pos" },
    ],
  },
  {
    label: "Keuangan",
    items: [
      { href: "/admin/billing/packages", label: "Paket", icon: "packages", module: "plans" },
      { href: "/admin/billing/subscriptions", label: "Langganan", icon: "subscriptions", module: "billing" },
      { href: "/admin/billing/invoices", label: "Tagihan", icon: "invoices", module: "billing" },
      { href: "/admin/cash-ledger", label: "Buku Kas", icon: "ledger", module: "cash_ledger" },
      { href: "/admin/payroll", label: "Gaji Pelatih", icon: "payroll", module: "payroll" },
    ],
  },
  {
    label: "Lainnya",
    items: [
      { href: "/admin/promo", label: "Promo", icon: "promo", module: "promo" },
      { href: "/admin/reports", label: "Laporan", icon: "reports" },
      { href: "/admin/audit", label: "Log Audit", icon: "audit" },
      { href: "/admin/settings", label: "Pengaturan", icon: "settings" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["owner", "staff"]);
  const tenant = await getCurrentTenant();
  const [enabled, terms] = await Promise.all([getEnabledModules(), getClubTerms()]);
  const owner = session.role === "owner" ? await loadOwner(session.id, session.tenantId) : null;
  const roleLabel = await loadRoleLabel(session.id, session.role);
  const tenants = owner ? await getSwitchableTenants(owner.ownerId) : [];
  const visible = adminGroups(terms.resource)
    .map((group) => ({
      label: group.label,
      items: group.items.filter(
        (item) => (!item.module || enabled.has(item.module)) && (owner || adminPathAllowed(false, session.permissions, item.href))
      ),
    }))
    .filter((group) => group.items.length > 0);
  const operationsPrimary = new Set(
    PRIMARY_OPERATIONS.filter((href) => visible.some((g) => g.items.some((i) => i.href === href))).slice(0, 2)
  );
  const orgItems: NavItem[] = [
    ...(owner ? [{ href: "/admin/klub", label: "Klub", icon: "club", exact: true } satisfies NavItem] : []),
    ...(owner || session.permissions.has("billing.view")
      ? [{ href: "/admin/klub/langganan", label: "Langganan", icon: "orgBilling" } satisfies NavItem]
      : []),
    ...(owner ? [{ href: "/admin/peran", label: "Peran", icon: "roles" } satisfies NavItem] : []),
    ...(owner ? [{ href: "/admin/klub/pemilik", label: "Pemilik", icon: "staff" } satisfies NavItem] : []),
    ...(owner ? [{ href: "/admin/klub/ekspor", label: "Ekspor data", icon: "reports" } satisfies NavItem] : []),
  ];
  const navGroups: NavGroup[] = [
    ...(orgItems.length > 0 ? [{ label: "Organisasi", items: orgItems }] : []),
    ...(session.billingLocked ? [] : visible).map((group) => ({
      label: group.label,
      items: group.items.map(({ href, label, icon, exact, primary }) => ({
        href,
        label,
        icon,
        exact,
        primary: primary || operationsPrimary.has(href),
      })),
    })),
  ];
  const switcher = tenants.length > 1 ? <LazyTenantSwitcher tenants={tenants} currentId={session.tenantId} /> : null;
  return (
    <AppShell
      personalSwitch
      navGroups={navGroups}
      fullName={session.fullName}
      profileHref="/admin/profile"
      roleLabel={roleLabel}
      clubName={tenant?.name ?? APP_NAME}
      tenantSwitcher={switcher}
    >
      {session.readOnly ? <ReadOnlyBanner canRenew={Boolean(owner) || session.permissions.has("billing.view")} /> : null}
      {children}
    </AppShell>
  );
}
