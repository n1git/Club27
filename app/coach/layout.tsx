import { requireRole } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/data/tenant";
import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup, NavItem } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";

const NAV_ITEMS: NavItem[] = [{ href: "/coach", label: "Jadwal Saya", icon: "schedule", primary: true }];
const HEAD_COACH_NAV_ITEMS: NavItem[] = [
  { href: "/coach/schedule", label: "Semua Jadwal", icon: "schedule", primary: true },
  { href: "/coach/members", label: "Semua Anggota", icon: "members", primary: true },
];

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("coach");
  const tenant = await getCurrentTenant();
  const navGroups: NavGroup[] = [{ items: session.isHeadCoach ? [...NAV_ITEMS, ...HEAD_COACH_NAV_ITEMS] : NAV_ITEMS }];
  return (
    <AppShell
      personalSwitch
      navGroups={navGroups}
      fullName={session.fullName}
      profileHref="/coach/profile"
      roleLabel={session.isHeadCoach ? "Kepala Pelatih" : "Pelatih"}
      clubName={tenant?.name ?? APP_NAME}
    >
      {children}
    </AppShell>
  );
}
