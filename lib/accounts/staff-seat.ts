import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTenantRoles, isInstructorRole, organizationIdForTenant } from "@/lib/data/roles";
import { PLAN_LIMIT_CODES } from "@/lib/actions/types";

interface Person {
  accountId: string;
  organizationId: string;
  tenantId: string;
  email: string;
  fullName: string;
}

function seatFailure(error: { code?: string; message: string } | null): string {
  return error?.code && PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal memperbarui keanggotaan seat";
}

export async function grantPaidMembership(person: Person): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data: existing } = await supabase
    .from("organization_users")
    .select("id, base_role, is_active")
    .eq("organization_id", person.organizationId)
    .eq("account_id", person.accountId)
    .maybeSingle();

  let memberId = existing?.id as string | undefined;
  if (existing && (existing.base_role === "p_owner" || existing.base_role === "owner")) return null;
  if (existing && !existing.is_active) {
    const { error } = await supabase.from("organization_users").update({ is_active: true }).eq("id", existing.id);
    if (error) return seatFailure(error);
  }
  if (!memberId) {
    const { data, error } = await supabase
      .from("organization_users")
      .insert({
        organization_id: person.organizationId,
        account_id: person.accountId,
        email: person.email,
        full_name: person.fullName,
        base_role: "staff",
      })
      .select("id")
      .single();
    if (error || !data) return seatFailure(error);
    memberId = data.id as string;
  }
  const { error } = await supabase
    .from("organization_user_clubs")
    .upsert({ member_id: memberId, club_id: person.tenantId }, { onConflict: "member_id,club_id", ignoreDuplicates: true });
  return error ? seatFailure(error) : null;
}

export async function syncPaidMembership(accountId: string, organizationId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: member } = await supabase
    .from("organization_users")
    .select("id, base_role")
    .eq("organization_id", organizationId)
    .eq("account_id", accountId)
    .maybeSingle();
  if (!member || member.base_role !== "staff") return;

  const { data: profiles } = await supabase
    .from("club_profiles")
    .select("club_id, organization_roles(is_paid), tenants:clubs!inner(organization_id)")
    .eq("account_id", accountId)
    .eq("role", "staff")
    .eq("is_active", true)
    .eq("tenants.organization_id", organizationId);
  const wanted = new Set(
    (profiles ?? [])
      .filter((p) => {
        const role = p.organization_roles as unknown as { is_paid: boolean } | { is_paid: boolean }[] | null;
        return Array.isArray(role) ? role[0]?.is_paid : role?.is_paid;
      })
      .map((p) => p.club_id as string)
  );

  const { data: assigned } = await supabase.from("organization_user_clubs").select("club_id").eq("member_id", member.id);
  for (const row of assigned ?? []) {
    if (!wanted.has(row.club_id as string)) {
      await supabase.from("organization_user_clubs").delete().eq("member_id", member.id).eq("club_id", row.club_id);
    }
  }
  if (wanted.size === 0) await supabase.from("organization_users").update({ is_active: false }).eq("id", member.id);
}

async function loadStaffProfile(profileId: string, tenantId: string) {
  const { data } = await createAdminSupabaseClient()
    .from("club_profiles")
    .select("id, account_id, email, full_name, is_active, org_role_id, organization_roles(is_paid)")
    .eq("id", profileId)
    .eq("club_id", tenantId)
    .eq("role", "staff")
    .maybeSingle();
  if (!data) return null;
  const role = data.organization_roles as unknown as { is_paid: boolean } | { is_paid: boolean }[] | null;
  return { ...data, isPaid: Boolean(Array.isArray(role) ? role[0]?.is_paid : role?.is_paid) };
}

export async function setStaffProfileActive(tenantId: string, profileId: string, isActive: boolean): Promise<string | null> {
  const target = await loadStaffProfile(profileId, tenantId);
  const organizationId = await organizationIdForTenant(tenantId);
  if (!target || !organizationId) return "Akun tidak ditemukan";

  if (isActive && target.isPaid && target.account_id) {
    const failure = await grantPaidMembership({
      accountId: target.account_id,
      organizationId,
      tenantId,
      email: target.email,
      fullName: target.full_name,
    });
    if (failure) return failure;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("club_profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .eq("role", "staff")
    .select("id");
  if (error || !data?.length) return error && PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal memperbarui status";
  if (!isActive && target.account_id) await syncPaidMembership(target.account_id, organizationId);
  return null;
}

export async function setStaffProfileRole(
  tenantId: string,
  profileId: string,
  roleId: string,
  instructor: boolean
): Promise<string | null> {
  const target = await loadStaffProfile(profileId, tenantId);
  const organizationId = await organizationIdForTenant(tenantId);
  const role = (await getTenantRoles(tenantId)).find((r) => r.id === roleId);
  if (!target || !organizationId || !role) return "Peran tidak valid";
  if (isInstructorRole(role) !== instructor) {
    return instructor ? "Pilih peran yang dapat menjadi pelatih" : "Pelatih diubah lewat halaman pelatih";
  }

  if (role.isPaid && target.account_id && target.is_active) {
    const failure = await grantPaidMembership({
      accountId: target.account_id,
      organizationId,
      tenantId,
      email: target.email,
      fullName: target.full_name,
    });
    if (failure) return failure;
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("club_profiles")
    .update({ org_role_id: role.id })
    .eq("id", profileId)
    .eq("role", "staff")
    .select("id");
  if (error || !data?.length) return error && PLAN_LIMIT_CODES.has(error.code) ? error.message : "Gagal mengubah peran";
  if (target.account_id) await syncPaidMembership(target.account_id, organizationId);
  return null;
}
