import { cache } from "react";
import { headers } from "next/headers";
import { isKeyRateLimited } from "@/lib/auth/rate-limit";
import { getSession } from "@/lib/auth/session";
import { isSocialBanned } from "@/lib/auth/social-access";
import { createServerSupabaseClient, createSupabaseClientWithToken } from "@/lib/supabase/server";
import { USERNAME_PATTERN, RESERVED_USERNAMES } from "@/lib/username-suggest";

export type ProfileRelation = "self" | "friends" | "pending_out" | "pending_in" | "none";

export type ProfileLookup =
  | { view: "member"; username: string; fullName: string; relation: ProfileRelation; viewerId: string }
  | { view: "public"; username: string; fullName: string; searchOk: boolean };

const LOOKUPS_PER_MINUTE = 120;

export const lookupProfile = cache(async (raw: string): Promise<ProfileLookup | null> => {
  let username: string;
  try {
    username = decodeURIComponent(raw).trim().toLowerCase();
  } catch {
    return null;
  }
  if (!USERNAME_PATTERN.test(username) || RESERVED_USERNAMES.has(username)) return null;

  const ip = (await headers()).get("x-real-ip")?.trim() || "unknown";
  if (await isKeyRateLimited(`profile:${ip}`, LOOKUPS_PER_MINUTE, 60)) return null;

  const session = await getSession();
  if (session && session.app_role === "personal" && !(await isSocialBanned(session.account_id))) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("profile_by_username", { p_username: username });
    if (error) return null;
    const row = (data as { username: string; full_name: string; relation: ProfileRelation }[] | null)?.[0];
    return row ? { view: "member", username: row.username, fullName: row.full_name, relation: row.relation, viewerId: session.account_id } : null;
  }

  const { data, error } = await createSupabaseClientWithToken(null).rpc("public_profile_by_username", { p_username: username });
  if (error) return null;
  const row = (data as { username: string; full_name: string; public_search_ok: boolean }[] | null)?.[0];
  return row ? { view: "public", username: row.username, fullName: row.full_name, searchOk: row.public_search_ok } : null;
});
