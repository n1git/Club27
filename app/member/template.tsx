import { requireRole } from "@/lib/auth/guard";

export default async function Template({ children }: { children: React.ReactNode }) {
  await requireRole("member");
  return children;
}
