import { requireModule } from "@/lib/modules";

export default async function ModuleLayout({ children }: { children: React.ReactNode }) {
  await requireModule("pos");
  return children;
}
