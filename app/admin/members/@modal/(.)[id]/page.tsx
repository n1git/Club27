import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentPermissions } from "@/lib/auth/guard";
import { getActiveCoaches, getLocations } from "@/lib/data/lookups";
import { Dialog } from "@/components/ui/dialog";
import { MemberEditForm } from "@/components/members/member-edit-form";
import { MemberPortalAccess } from "@/components/members/member-portal-access";
import { isModuleReady } from "@/lib/modules";
import { MemberVisits } from "@/components/checkin/member-visits";

export default async function MemberDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const [{ data: member }, locations, coaches, session] = await Promise.all([
    supabase
      .from("club_members")
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
    <Dialog>
      <h2 className="mb-4 text-xl font-semibold">{member.full_name}</h2>
      <MemberEditForm
        member={member}
        locations={locations}
        coaches={coaches}
        canChangeStatus={session.has("members.change_status")}
      />
      {portalReady && member.is_active ? (
        <div className="mt-6">
          <MemberPortalAccess memberId={member.id} hasAccount={Boolean(member.profile_id)} />
        </div>
      ) : null}
      {checkinOn ? (
        <div className="mt-6">
          <MemberVisits memberId={member.id} />
        </div>
      ) : null}
    </Dialog>
  );
}

export const unstable_dynamicStaleTime = 0;
