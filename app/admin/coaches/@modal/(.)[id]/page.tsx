import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTenantRoles, isInstructorRole } from "@/lib/data/roles";
import { Dialog } from "@/components/ui/dialog";
import { CoachEditForm } from "@/components/coaches/coach-edit-form";
import { CoachMembers } from "@/components/coaches/coach-members";
import { CoachCertifications } from "@/components/coaches/coach-certifications";

export default async function CoachDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("coaches.manage");
  const roles = (await getTenantRoles(user.tenantId)).filter(isInstructorRole);
  const supabase = await createServerSupabaseClient();
  const { data: coach } = await supabase
    .from("instructors")
    .select("id, full_name, email, phone, is_active, specialization, session_rate, org_role_id")
    .eq("id", id)
    .maybeSingle();

  if (!coach) notFound();

  return (
    <Dialog>
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{coach.full_name}</h2>
        <p className="text-sm text-muted-foreground">{coach.email}</p>
      </div>
      <CoachEditForm coach={coach} roles={roles} />
      <div className="mt-6 flex flex-col gap-6">
        <CoachCertifications coachId={coach.id} />
        <CoachMembers coachId={coach.id} />
      </div>
    </Dialog>
  );
}
