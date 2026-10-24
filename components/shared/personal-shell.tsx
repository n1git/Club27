import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { PERSONAL_HOME } from "@/lib/auth/roles";
import { socialRestriction } from "@/lib/auth/social-access";
import { getSocialBadges } from "@/lib/data/social";
import { getUnreadCounts } from "@/lib/data/notifications";
import { TopBarActions } from "@/components/personal/top-bar-actions";
import { getReadyClubTypes } from "@/lib/club-type";
import { getJakartaDateString } from "@/lib/format";
import { QuickAddProvider } from "@/components/personal/quick-add";
import { Alert, AlertDescription } from "@/components/ui/alert";

export async function PersonalShell({ user, children }: { user: { fullName: string; accountId: string }; children: React.ReactNode }) {
  const [restriction, badges, clubTypes] = await Promise.all([socialRestriction(user.accountId), getSocialBadges(user.accountId), getReadyClubTypes()]);
  const unread = restriction === null ? await getUnreadCounts() : null;
  const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
  const allGroups: NavGroup[] = [
    {
      items: [
        { href: PERSONAL_HOME, label: "Beranda", icon: "home", exact: true, primary: true },
        { href: "/friends", label: "Teman", icon: "members", primary: true, badge: badges.friends },
        { href: "/groups", label: "Grup", icon: "schedule", primary: true, badge: badges.groups },
        { href: "/workouts", label: "Latihan", icon: "visits", primary: true },
        { href: "/challenges", label: "Tantangan", icon: "trophy" },
        { href: "/health", label: "Kesehatan", icon: "reports" },
        { href: "/profile", label: "Profil", icon: "profile" },
        { href: "/join", label: "Gabung klub", icon: "switchClub" },
        { href: "/upgrade", label: "Upgrade", icon: "club" },
        { href: "/settings", label: "Pengaturan", icon: "settings" },
      ],
    },
  ];
  const hidden = new Set(restriction === "minor" ? ["/friends", "/groups", "/challenges", "/health"] : restriction ? ["/friends", "/groups", "/challenges"] : []);
  const navGroups = allGroups.map((g) => ({ ...g, items: g.items.filter((i) => !hidden.has(i.href)) }));
  return (
    <QuickAddProvider canSocial={restriction === null} sports={sports} today={getJakartaDateString()}>
    <AppShell
      navGroups={navGroups}
      fullName={user.fullName}
      profileHref="/profile"
      roleLabel="Akun"
      clubName={APP_NAME}
      quickAdd
      topActions={unread ? <TopBarActions notifications={unread.notifications} messages={unread.messages} /> : null}
    >
      {restriction === "banned" ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Fitur sosial akun Anda dinonaktifkan oleh admin platform. Latihan pribadi dan akses klub tetap berjalan.</AlertDescription>
        </Alert>
      ) : restriction === "minor" ? (
        <Alert className="mb-4">
          <AlertDescription>Fitur sosial dan catatan kesehatan hanya untuk pengguna berusia 18 tahun ke atas. Latihan pribadi tetap bisa dicatat.</AlertDescription>
        </Alert>
      ) : null}
      {children}
    </AppShell>
    </QuickAddProvider>
  );
}
