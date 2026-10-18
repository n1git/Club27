import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { PERSONAL_HOME } from "@/lib/auth/roles";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getSocialBadges } from "@/lib/data/social";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("personal");
  const [banned, badges] = await Promise.all([isSocialBanned(user.accountId), getSocialBadges(user.accountId)]);
  const allGroups: NavGroup[] = [
    {
      items: [
        { href: PERSONAL_HOME, label: "Beranda", icon: "home", exact: true, primary: true },
        { href: "/akun/teman", label: "Teman", icon: "members", primary: true, badge: badges.friends },
        { href: "/akun/grup", label: "Grup", icon: "schedule", primary: true, badge: badges.groups },
        { href: "/akun/latihan", label: "Latihan", icon: "visits", primary: true },
        { href: "/akun/profil", label: "Profil", icon: "profile" },
        { href: "/akun/klub", label: "Gabung klub", icon: "switchClub" },
        { href: "/akun/upgrade", label: "Upgrade", icon: "club" },
        { href: "/akun/pengaturan", label: "Pengaturan", icon: "settings" },
      ],
    },
  ];
  const navGroups = banned
    ? allGroups.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== "/akun/teman" && i.href !== "/akun/grup") }))
    : allGroups;
  return (
    <AppShell
      navGroups={navGroups}
      fullName={user.fullName}
      profileHref="/akun/profil"
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
