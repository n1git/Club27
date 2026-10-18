import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/shared/app-shell";
import type { NavGroup } from "@/components/shared/nav-types";
import { APP_NAME } from "@/lib/config";
import { PERSONAL_HOME } from "@/lib/auth/roles";

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("personal");
  const navGroups: NavGroup[] = [
    {
      items: [
        { href: PERSONAL_HOME, label: "Beranda", icon: "home", exact: true, primary: true },
        { href: "/akun/teman", label: "Teman", icon: "members", primary: true },
        { href: "/akun/grup", label: "Grup", icon: "schedule", primary: true },
        { href: "/akun/latihan", label: "Latihan", icon: "visits", primary: true },
        { href: "/akun/profil", label: "Profil", icon: "profile" },
        { href: "/akun/klub", label: "Gabung klub", icon: "switchClub" },
        { href: "/akun/upgrade", label: "Upgrade", icon: "club" },
        { href: "/akun/pengaturan", label: "Pengaturan", icon: "settings" },
      ],
    },
  ];
  return (
    <AppShell
      navGroups={navGroups}
      fullName={user.fullName}
      profileHref="/akun/profil"
      roleLabel="Akun"
      clubName={APP_NAME}
    >
      {children}
    </AppShell>
  );
}
