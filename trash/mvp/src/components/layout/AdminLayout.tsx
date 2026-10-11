import { AppShell, type NavItem } from "./AppShell";

const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Dasbor" },
  { to: "/admin/members", label: "Anggota" },
  { to: "/admin/coaches", label: "Pelatih" },
  { to: "/admin/schedule", label: "Jadwal" },
  { to: "/admin/billing/packages", label: "Paket" },
  { to: "/admin/billing/subscriptions", label: "Langganan" },
  { to: "/admin/billing/invoices", label: "Tagihan" },
  { to: "/admin/cash-ledger", label: "Buku Kas" },
  { to: "/admin/payroll", label: "Gaji Pelatih" },
  { to: "/admin/promo", label: "Promo" },
  { to: "/admin/reports", label: "Laporan" },
  { to: "/admin/settings", label: "Pengaturan" },
];

export function AdminLayout() {
  return <AppShell navItems={NAV_ITEMS} roleLabel="Admin" />;
}
