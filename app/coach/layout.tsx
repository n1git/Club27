import { loadRoleLabel, requireRole } from "@/lib/auth/guard";
import { getCurrentTenant } from "@/lib/data/tenant";
import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup, NavItem } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { ReadOnlyBanner } from "@/components/subscription/read-only-banner";

const NAV_ITEMS: NavItem[] = [{ href: "/coach", label: "Jadwal Saya", icon: "schedule", primary: true }];
const HEAD_COACH_NAV_ITEMS: NavItem[] = [
  { href: "/coach/schedule", label: "Semua Jadwal", icon: "schedule", primary: true },
  { href: "/coach/members", label: "Semua Anggota", icon: "members", primary: true },
];

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole(["owner", "staff"]);
  const tenant = await getCurrentTenant();
  const navGroups: NavGroup[] = [{ items: session.permissions.has("members.view_all") ? [...NAV_ITEMS, ...HEAD_COACH_NAV_ITEMS] : NAV_ITEMS }];
  return (
    <AppShell
      personalSwitch
      navGroups={navGroups}
      fullName={session.fullName}
      profileHref="/coach/profile"
      roleLabel={await loadRoleLabel(session.id, session.role)}
      clubName={tenant?.name ?? APP_NAME}
    >
      {session.readOnly ? <ReadOnlyBanner canRenew={session.permissions.has("billing.view")} /> : null}
      {children}
    </AppShell>
  );
}
