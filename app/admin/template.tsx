import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/guard";

export default async function Template({ children }: { children: React.ReactNode }) {
  await requireRole(STAFF_ROLES);
  return children;
}
