import { requireRole } from "@/lib/auth/guard";
import { isModuleReady, requireModule } from "@/lib/modules";
import { getCurrentTenant } from "@/lib/data/tenant";
import { listClubsForProfile } from "@/lib/data/member-clubs";
import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup, NavItem } from "@/components/shared/nav-types";
import { LazyClubSwitcher } from "@/components/member/lazy-club-switcher";
import { APP_NAME } from "@/lib/config";
import { ReadOnlyBanner } from "@/components/subscription/read-only-banner";
import { isSocialBanned } from "@/lib/auth/social-access";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("member");
  await requireModule("member_portal");
  const [tenant, clubs, checkinOn, bookingOn, posOn, socialOff] = await Promise.all([
    getCurrentTenant(),
    listClubsForProfile(user.id),
    isModuleReady("checkin"),
    isModuleReady("resource_booking"),
    isModuleReady("pos"),
    isSocialBanned(user.accountId),
  ]);

  const navItems: NavItem[] = user.clubPending
    ? [{ href: "/member/clubs", label: "Pilih Klub", icon: "switchClub", primary: true } satisfies NavItem]
    : [
        { href: "/member", label: "Beranda", icon: "home", exact: true, primary: true } satisfies NavItem,
        ...(socialOff ? [] : [{ href: "/member/leaderboard", label: "Peringkat", icon: "trophy" } satisfies NavItem]),
        ...(bookingOn ? [{ href: "/member/booking", label: "Booking", icon: "booking", primary: true } satisfies NavItem] : []),
        ...(posOn ? [{ href: "/member/orders", label: "Pesanan", icon: "orders", primary: true } satisfies NavItem] : []),
        ...(checkinOn ? [{ href: "/member/visits", label: "Kunjungan", icon: "visits", primary: true } satisfies NavItem] : []),
        ...(clubs.length > 1 ? [{ href: "/member/clubs", label: "Klub Saya", icon: "switchClub" } satisfies NavItem] : []),
      ];

  return (
    <AppShell
      personalSwitch
      navGroups={[{ items: navItems }] satisfies NavGroup[]}
      fullName={user.fullName}
      profileHref="/profile"
      roleLabel="Anggota"
      clubName={user.clubPending ? APP_NAME : (tenant?.name ?? APP_NAME)}
      tenantSwitcher={
        clubs.length > 1 && !user.clubPending ? <LazyClubSwitcher clubs={clubs} currentId={user.tenantId} /> : null
      }
    >
      {user.readOnly ? <ReadOnlyBanner canRenew={false} /> : null}
      {children}
    </AppShell>
  );
}
