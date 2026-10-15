import { getSession } from "@/lib/auth/session";
import { BackLink } from "@/components/shared/back-link";
import { ClassDetail } from "@/components/schedule/class-detail";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/admin/schedule" label="Jadwal Kelas" />
      <ClassDetail id={id} role={session!.app_role} variant="page" />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
