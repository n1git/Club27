import type { SupabaseClient } from "@supabase/supabase-js";

export async function buildMemberExport(supabase: SupabaseClient, memberId: string) {
  const { data: member } = await supabase
    .from("club_members")
    .select("id, full_name, date_of_birth, contact_name, contact_phone, address, notes, is_active, created_at, updated_at, profile_id")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return null;

  const [profile, subscriptions, invoices, bookings, checkins, orders, resourceBookings, consents] = await Promise.all([
    member.profile_id
      ? supabase.from("club_profiles").select("id, email, full_name, phone, created_at").eq("id", member.profile_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("member_memberships").select("id, status, start_date, end_date, created_at, membership_packages(name)").eq("member_id", memberId),
    supabase.from("invoices").select("id, amount, status, due_date, period_start, period_end, paid_at, created_at").eq("member_id", memberId),
    supabase.from("class_bookings").select("id, is_attended, attended_at, notes, created_at, classes(start_time, end_time)").eq("member_id", memberId),
    supabase.from("checkins").select("id, checked_in_at, method").eq("member_id", memberId),
    supabase.from("orders").select("id, number, status, total, created_at, paid_at, voided_at").eq("member_id", memberId),
    supabase.from("resource_bookings").select("id, start_time, end_time, status, price, created_at").eq("member_id", memberId),
    supabase.from("consents").select("kind, version, guardian_name, accepted_at").eq("subject_type", "member").eq("subject_id", memberId),
  ]);

  return {
    exported_at: new Date().toISOString(),
    member,
    account: profile.data,
    subscriptions: subscriptions.data ?? [],
    invoices: invoices.data ?? [],
    bookings: bookings.data ?? [],
    checkins: checkins.data ?? [],
    orders: orders.data ?? [],
    resource_bookings: resourceBookings.data ?? [],
    consents: consents.data ?? [],
  };
}

export function jsonDownload(data: unknown, filename: string) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
