import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { PERSONAL_HOME } from "@/lib/auth/roles";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getSocialBadges } from "@/lib/data/social";
import { Alert, AlertDescription } from "@/components/ui/alert";

export async function PersonalShell({ user, children }: { user: { fullName: string; accountId: string }; children: React.ReactNode }) {
  const [banned, badges] = await Promise.all([isSocialBanned(user.accountId), getSocialBadges(user.accountId)]);
  const allGroups: NavGroup[] = [
    {
      items: [
        { href: PERSONAL_HOME, label: "Beranda", icon: "home", exact: true, primary: true },
        { href: "/home/friends", label: "Teman", icon: "members", primary: true, badge: badges.friends },
        { href: "/home/groups", label: "Grup", icon: "schedule", primary: true, badge: badges.groups },
        { href: "/home/workouts", label: "Latihan", icon: "visits", primary: true },
        { href: "/profile", label: "Profil", icon: "profile" },
        { href: "/home/join-club", label: "Gabung klub", icon: "switchClub" },
        { href: "/home/upgrade", label: "Upgrade", icon: "club" },
        { href: "/home/settings", label: "Pengaturan", icon: "settings" },
      ],
    },
  ];
  const navGroups = banned
    ? allGroups.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/home/friends" && i.href !== "/home/groups") }))
    : allGroups;
  return (
    <AppShell
      navGroups={navGroups}
      fullName={user.fullName}
      profileHref="/profile"
      roleLabel="Akun"
      clubName={APP_NAME}
    >
      {banned ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>Fitur sosial akun Anda dinonaktifkan oleh admin platform. Latihan pribadi dan akses klub tetap berjalan.</AlertDescription>
        </Alert>
      ) : null}
      {children}
    </AppShell>
  );
}
