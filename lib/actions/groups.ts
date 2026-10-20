"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireActionRole } from "@/lib/auth/guard";
import { socialLimited } from "@/lib/auth/social-limit";
import { socialBlocked } from "@/lib/auth/social-access";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseJakartaLocalInput } from "@/lib/format";
import { eventSchema, groupSchema, rsvpSchema } from "@/lib/validations/groups";
import { uuidField } from "@/lib/validations/social";
import { type ActionState } from "./types";

const KNOWN = new Set(["GR001", "GR002", "GR003", "GR004", "GR005", "EV001", "EV002", "EV003", "EV004"]);

function fail(error: { code?: string; message: string } | null, fallback: string): ActionState {
  if (error?.code === "42501") return { ok: false, error: "Anda tidak punya akses untuk aksi ini" };
  return { ok: false, error: error?.code && KNOWN.has(error.code) ? error.message : fallback };
}

function done(): ActionState {
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createGroup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "group", 10);
  if (limited) return limited;
  const parsed = groupSchema.safeParse({ name: formData.get("name"), description: formData.get("description") || undefined });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_group", { p_name: parsed.data.name, p_description: parsed.data.description ?? null });
  if (error || !data) return fail(error, "Gagal membuat grup");
  revalidatePath("/", "layout");
  redirect(`/g/${data}`);
}

export async function inviteToGroup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "invite", 60);
  if (limited) return limited;
  const group = uuidField.safeParse(formData.get("groupId"));
  const account = uuidField.safeParse(formData.get("accountId"));
  if (!group.success || !account.success) return { ok: false, error: "Pilih teman yang akan diundang" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("invite_to_group", { p_group: group.data, p_account: account.data });
  return error ? fail(error, "Gagal mengundang") : done();
}

export async function respondGroupInvite(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  if (formData.get("accept") === "1") {
    const blocked = await socialBlocked(session.account_id);
    if (blocked) return blocked;
  }
  const group = uuidField.safeParse(formData.get("groupId"));
  if (!group.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("respond_group_invite", { p_group: group.data, p_accept: formData.get("accept") === "1" });
  return error ? fail(error, "Gagal memproses undangan") : done();
}

export async function leaveGroup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const group = uuidField.safeParse(formData.get("groupId"));
  if (!group.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("leave_group", { p_group: group.data });
  if (error) return fail(error, "Gagal keluar dari grup");
  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function removeGroupMember(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const group = uuidField.safeParse(formData.get("groupId"));
  const account = uuidField.safeParse(formData.get("accountId"));
  if (!group.success || !account.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_group_member", { p_group: group.data, p_account: account.data });
  return error ? fail(error, "Gagal mengeluarkan anggota") : done();
}

export async function deleteGroup(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const group = uuidField.safeParse(formData.get("groupId"));
  if (!group.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("delete_group", { p_group: group.data });
  if (error) return fail(error, "Gagal menghapus grup");
  revalidatePath("/", "layout");
  redirect("/groups");
}

export async function createEvent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const limited = await socialLimited(session.account_id, "event", 20);
  if (limited) return limited;
  const parsed = eventSchema.safeParse({
    groupId: formData.get("groupId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt") || undefined,
    capacity: formData.get("capacity"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_event", {
    p_group: parsed.data.groupId,
    p_title: parsed.data.title,
    p_description: parsed.data.description ?? null,
    p_location: parsed.data.location ?? null,
    p_starts: parsed.data.startsAt ? parseJakartaLocalInput(parsed.data.startsAt) : null,
    p_ends: parsed.data.endsAt ? parseJakartaLocalInput(parsed.data.endsAt) : null,
    p_capacity: parsed.data.capacity ?? null,
  });
  return error ? fail(error, "Gagal membuat event") : done();
}

export async function cancelEvent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionRole("personal");
  const event = uuidField.safeParse(formData.get("eventId"));
  if (!event.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_event", { p_event: event.data });
  return error ? fail(error, "Gagal membatalkan event") : done();
}

export async function rsvpEvent(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireActionRole("personal");
  const blocked = await socialBlocked(session.account_id);
  if (blocked) return blocked;
  const parsed = rsvpSchema.safeParse({ eventId: formData.get("eventId"), status: formData.get("status") });
  if (!parsed.success) return { ok: false, error: "Data tidak valid" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("rsvp_event", { p_event: parsed.data.eventId, p_status: parsed.data.status });
  return error ? fail(error, "Gagal menyimpan jawaban") : done();
}
