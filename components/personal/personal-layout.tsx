import { requireRole } from "@/lib/auth/guard";
import { PersonalShell } from "@/components/shared/personal-shell";

export async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("personal");
  return <PersonalShell user={user}>{children}</PersonalShell>;
}
