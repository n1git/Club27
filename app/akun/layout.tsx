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
        { href: PERSONAL_HOME, label: "Akun Saya", icon: "profile", exact: true, primary: true },
        { href: "/akun/latihan", label: "Latihan", icon: "visits", primary: true },
      ],
    },
  ];
  return (
    <AppShell
      navGroups={navGroups}
      fullName={user.fullName}
      profileHref={PERSONAL_HOME}
      roleLabel="Akun"
      clubName={APP_NAME}
    >
      {children}
    </AppShell>
  );
}
