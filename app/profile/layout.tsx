import { requireRole } from "@/lib/auth/guard";
import { AppShell } from "@/components/shared/app-shell";
import { PersonalShell } from "@/components/shared/personal-shell";
import { APP_ROLES } from "@/lib/auth/roles";
import { APP_NAME } from "@/lib/config";

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(APP_ROLES);
  if (user.role === "personal") return <PersonalShell user={user}>{children}</PersonalShell>;
  return (
    <AppShell
      personalSwitch
      navGroups={[{ items: [{ href: "/profile", label: "Profil", icon: "profile", exact: true, primary: true }] }]}
      fullName={user.fullName}
      profileHref="/profile"
      roleLabel="Akun"
      clubName={APP_NAME}
    >
      {children}
    </AppShell>
  );
}
