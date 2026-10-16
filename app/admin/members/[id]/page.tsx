import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentPermissions } from "@/lib/auth/guard";
import { getActiveCoaches, getLocations } from "@/lib/data/lookups";
import { BackLink } from "@/components/shared/back-link";
import { MemberEditForm } from "@/components/members/member-edit-form";
import { MemberPortalAccess } from "@/components/members/member-portal-access";
import { isModuleReady } from "@/lib/modules";
import { MemberVisits } from "@/components/checkin/member-visits";
import { MemberPrivacy } from "@/components/members/member-privacy";
import { PageHeader } from "@/components/ui/page-header";

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: member }, locations, coaches, session] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, date_of_birth, notes, address, preferred_location_id, is_active, coach_id, contact_name, contact_phone, profile_id"
      )
      .eq("id", id)
      .maybeSingle(),
    getLocations(),
    getActiveCoaches(),
    currentPermissions(),
  ]);
  const portalReady = session.has("members.portal") && (await isModuleReady("member_portal"));
  const checkinOn = await isModuleReady("checkin");

  if (!member) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/admin/members" label="Anggota" />
      <PageHeader title={<>{member.full_name}</>} />
      <MemberEditForm
        member={member}
        locations={locations}
        coaches={coaches}
        canChangeStatus={session.has("members.change_status")}
      />
      {portalReady && member.is_active ? <MemberPortalAccess memberId={member.id} hasAccount={Boolean(member.profile_id)} /> : null}
      {checkinOn ? <MemberVisits memberId={member.id} /> : null}
      {session.has("members.privacy") ? <MemberPrivacy memberId={member.id} /> : null}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
