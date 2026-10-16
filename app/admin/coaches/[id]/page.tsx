import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTenantRoles, isInstructorRole } from "@/lib/data/roles";
import { BackLink } from "@/components/shared/back-link";
import { CoachEditForm } from "@/components/coaches/coach-edit-form";
import { CoachMembers } from "@/components/coaches/coach-members";
import { CoachCertifications } from "@/components/coaches/coach-certifications";
import { PageHeader } from "@/components/ui/page-header";

export default async function CoachDetailPage({
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
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/admin/coaches" label="Pelatih" />
      <div>
        <PageHeader title={<>{coach.full_name}</>} />
        <p className="text-sm text-muted-foreground">{coach.email}</p>
      </div>
      <CoachEditForm coach={coach} roles={roles} />
      <CoachCertifications coachId={coach.id} />
      <CoachMembers coachId={coach.id} />
    </div>
  );
}
