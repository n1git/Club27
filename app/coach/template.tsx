import { requirePermission } from "@/lib/auth/guard";

export default async function Template({ children }: { children: React.ReactNode }) {
  await requirePermission("teaching.portal");
  return children;
}
