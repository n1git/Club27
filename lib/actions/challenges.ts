"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionPermission, requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
import { socialBlocked } from "@/lib/auth/social-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { challengeSchema } from "@/lib/validations/challenge";
import { uuidField } from "@/lib/validations/social";
import { type ActionState } from "./types";

const KNOWN = new Set(["CH001", "CH002", "CH003", "CH004", "SW003"]);

function fail(error: { code?: string; message: string }, fallback: string): ActionState {
  return { ok: false, error: error.code && KNOWN.has(error.code) ? error.message : fallback };
}

function parse(formData: FormData) {
  return challengeSchema.safeParse({
    name: formData.get("name"),
    metric: formData.get("metric"),
    target: formData.get("target"),
    sport: formData.get("sport"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
  });
}

async function create(groupId: string | null, clubId: string | null, formData: FormData): Promise<ActionState> {
  const parsed = parse(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_challenge", {
    p_group: groupId,
    p_club: clubId,
    p_name: parsed.data.name,
    p_metric: parsed.data.metric,
    p_target: parsed.data.target,
    p_sport: parsed.data.sport ?? null,
    p_starts: parsed.data.startsOn,
    p_ends: parsed.data.endsOn,
  });
  return error ? fail(error, "Gagal membuat tantangan") : { ok: true, message: "Tantangan dibuat" };
}

export async function createGroupChallenge(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "challenge", 20);
  if (limited) return limited;
  const groupId = uuidField.safeParse(formData.get("groupId"));
  if (!groupId.success) return { ok: false, error: "Pilih grup" };
  const result = await create(groupId.data, null, formData);
  if (result.ok) revalidatePath("/home/challenges");
  return result;
}

export async function createClubChallenge(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionPermission("challenges.manage");
  const result = await create(null, session.club_id, formData);
  if (result.ok) revalidatePath("/admin/challenges");
  return result;
}

export async function joinChallenge(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const blocked = await socialBlocked(session.account_id);
  if (blocked) return blocked;
  const id = uuidField.safeParse(formData.get("challengeId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("join_challenge", { p_id: id.data });
  if (error) return fail(error, "Gagal mengikuti tantangan");
  revalidatePath("/home/challenges", "layout");
  return { ok: true, message: "Anda ikut tantangan ini" };
}

export async function leaveChallenge(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const id = uuidField.safeParse(formData.get("challengeId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("leave_challenge", { p_id: id.data });
  if (error) return fail(error, "Gagal keluar dari tantangan");
  revalidatePath("/home/challenges", "layout");
  return { ok: true, message: "Anda keluar dari tantangan" };
}

async function remove(formData: FormData): Promise<ActionState> {
  const id = uuidField.safeParse(formData.get("challengeId"));
  if (!id.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_challenge", { p_id: id.data });
  return error ? fail(error, "Gagal menghapus tantangan") : { ok: true };
}

export async function deleteGroupChallenge(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const result = await remove(formData);
  if (!result.ok) return result;
  revalidatePath("/home/challenges", "layout");
  redirect("/home/challenges");
}

export async function deleteClubChallenge(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("challenges.manage");
  const result = await remove(formData);
  if (result.ok) revalidatePath("/admin/challenges");
  return result;
}
