import { requireAdminArea } from "@/lib/auth/guard";

export default async function Template({ children }: { children: React.ReactNode }) {
  await requireAdminArea();
  return children;
}
