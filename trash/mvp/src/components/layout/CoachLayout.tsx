import { AppShell, type NavItem } from "./AppShell";

const NAV_ITEMS: NavItem[] = [{ to: "/coach", label: "Jadwal Saya" }];

export function CoachLayout() {
  return <AppShell navItems={NAV_ITEMS} roleLabel="Pelatih" />;
}
