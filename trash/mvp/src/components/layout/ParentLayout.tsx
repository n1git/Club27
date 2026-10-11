import { AppShell, type NavItem } from "./AppShell";

const NAV_ITEMS: NavItem[] = [
  { to: "/parent", label: "Jadwal Anak" },
  { to: "/parent/billing", label: "Tagihan" },
  { to: "/parent/promo", label: "Promo" },
];

export function ParentLayout() {
  return <AppShell navItems={NAV_ITEMS} roleLabel="Orang Tua" />;
}
