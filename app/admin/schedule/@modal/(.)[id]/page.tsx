import { getSession } from "@/lib/auth/session";
import { Dialog } from "@/components/ui/dialog";
import { ClassDetail } from "@/components/schedule/class-detail";

export default async function ClassDetailModal({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, getSession()]);
  return (
    <Dialog className="max-w-2xl">
      <ClassDetail id={id} role={session!.app_role} variant="modal" />
    </Dialog>
  );
}

export const unstable_dynamicStaleTime = 0;
