import { currentPermissions } from "@/lib/auth/guard";
import { Dialog } from "@/components/ui/dialog";
import { ClassDetail } from "@/components/schedule/class-detail";

export default async function ClassDetailModal({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, currentPermissions()]);
  return (
    <Dialog className="max-w-2xl">
      <ClassDetail id={id} canManage={session.has("schedule.manage")} variant="modal" />
    </Dialog>
  );
}

export const unstable_dynamicStaleTime = 0;
