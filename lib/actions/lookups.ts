"use server";

import { z } from "zod";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Lookup } from "@/lib/data/lookups";

const MAX_RESULTS = 20;

export async function searchActiveMembers(query: string): Promise<Lookup[]> {
  await requireActionPermission("members.lookup");
  const q = z.string().trim().max(100).catch("").parse(query).replace(/[%_\\]/g, "");
  const supabase = await createServerSupabaseClient();
  let request = supabase.from("member_names").select("id, full_name").eq("is_active", true).order("full_name").limit(MAX_RESULTS);
  if (q) request = request.ilike("full_name", `%${q}%`);
  const { data } = await request;
  return (data ?? []).map((m) => ({ id: m.id, name: m.full_name }));
}
