import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
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
      .from("members")
      .select(
        "id, full_name, date_of_birth, notes, address, preferred_location_id, is_active, coach_id, contact_name, contact_phone, profile_id"
      )
      .eq("id", id)
      .maybeSingle(),
    getLocations(),
    getActiveCoaches(),
    getSession(),
  ]);
  const portalReady = session?.app_role === "admin" && (await isModuleReady("member_portal"));
  const checkinOn = await isModuleReady("checkin");

  if (!member) notFound();

  return (
    <Dialog>
      <h2 className="mb-4 text-xl font-semibold">{member.full_name}</h2>
      <MemberEditForm
        member={member}
        locations={locations}
        coaches={coaches}
        canChangeStatus={session?.app_role === "admin"}
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
