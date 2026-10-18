import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface MyJoinRequest {
  id: string;
  clubName: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
}

export async function getMyJoinRequests(accountId: string): Promise<MyJoinRequest[]> {
  const { data } = await createAdminSupabaseClient()
    .from("club_join_requests")
    .select("id, status, created_at, clubs(name)")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []).map((r) => {
    const club = r.clubs as unknown as { name: string } | { name: string }[] | null;
    return {
      id: r.id as string,
      clubName: (Array.isArray(club) ? club[0]?.name : club?.name) ?? "Klub",
      status: r.status as MyJoinRequest["status"],
      createdAt: r.created_at as string,
    };
  });
}

export interface ClubJoinRequest {
  id: string;
  fullName: string;
  dateOfBirth: string;
  phone: string | null;
  message: string | null;
  createdAt: string;
  similar: { id: string; fullName: string; dateOfBirth: string }[];
}

export async function getPendingClubJoinRequests(): Promise<{ slug: string; requests: ClubJoinRequest[] }> {
  const supabase = await createServerSupabaseClient();
  const [{ data: club }, { data: rows }] = await Promise.all([
    supabase.from("clubs").select("slug").maybeSingle(),
    supabase
      .from("club_join_requests")
      .select("id, full_name, date_of_birth, phone, message, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(50),
  ]);
  const requests = await Promise.all(
    (rows ?? []).map(async (r) => {
      const { data: similar } = await supabase.rpc("search_similar_members", {
        p_full_name: r.full_name,
        p_date_of_birth: r.date_of_birth,
      });
      const ids = ((similar ?? []) as { id: string }[]).map((s) => s.id);
      const { data: free } = ids.length
        ? await supabase.from("club_members").select("id, full_name, date_of_birth").in("id", ids).is("profile_id", null)
        : { data: [] };
      return {
        id: r.id as string,
        fullName: r.full_name as string,
        dateOfBirth: r.date_of_birth as string,
        phone: r.phone as string | null,
        message: r.message as string | null,
        createdAt: r.created_at as string,
        similar: (free ?? []).map((m) => ({ id: m.id as string, fullName: m.full_name as string, dateOfBirth: m.date_of_birth as string })),
      };
    })
  );
  return { slug: (club?.slug as string | undefined) ?? "", requests };
}
