import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { PERSONAL_HOME } from "@/lib/auth/roles";
import { socialRestriction } from "@/lib/auth/social-access";
import { getSocialBadges } from "@/lib/data/social";
import { Alert, AlertDescription } from "@/components/ui/alert";

export async function PersonalShell({ user, children }: { user: { fullName: string; accountId: string }; children: React.ReactNode }) {
  const [restriction, badges] = await Promise.all([socialRestriction(user.accountId), getSocialBadges(user.accountId)]);
  const allGroups: NavGroup[] = [
    {
      items: [
        { href: PERSONAL_HOME, label: "Beranda", icon: "home", exact: true, primary: true },
        { href: "/home/friends", label: "Teman", icon: "members", primary: true, badge: badges.friends },
        { href: "/home/groups", label: "Grup", icon: "schedule", primary: true, badge: badges.groups },
        { href: "/home/workouts", label: "Latihan", icon: "visits", primary: true },
        { href: "/home/health", label: "Kesehatan", icon: "reports" },
        { href: "/profile", label: "Profil", icon: "profile" },
        { href: "/home/join-club", label: "Gabung klub", icon: "switchClub" },
        { href: "/home/upgrade", label: "Upgrade", icon: "club" },
        { href: "/home/settings", label: "Pengaturan", icon: "settings" },
      ],
    },
  ];
  const hidden = new Set(restriction === "minor" ? ["/home/friends", "/home/groups", "/home/health"] : restriction ? ["/home/friends", "/home/groups"] : []);
  const navGroups = allGroups.map((g) => ({ ...g, items: g.items.filter((i) => !hidden.has(i.href)) }));
  return (
    <AppShell
      navGroups={navGroups}
      fullName={user.fullName}
      profileHref="/profile"
      roleLabel="Akun"
      clubName={APP_NAME}
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
  );
}
