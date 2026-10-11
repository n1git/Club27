"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { checkSession, sessionEndedPath } from "@/lib/auth/guard";
import { createSession, getSession } from "@/lib/auth/session";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { nameField, phoneField } from "@/lib/validations/limits";
import { superadminUsernameSchema, usernameDbError, usernameSchema } from "@/lib/validations/username";
import type { ActionState } from "./types";

const ownerSchema = z.object({ fullName: nameField("Nama"), username: usernameSchema });
const staffSchema = ownerSchema.extend({ phone: phoneField.optional() });
const memberSchema = z.object({ username: usernameSchema });
const superadminSchema = z.object({ fullName: nameField("Nama"), username: superadminUsernameSchema });

type Values = Record<string, string | null>;

function diff(before: Values, after: Values) {
  return Object.fromEntries(
    Object.keys(after)
      .filter((key) => (before[key] ?? null) !== (after[key] ?? null))
      .map((key) => [key, { from: before[key] ?? null, to: after[key] ?? null }])
  );
}

function failure(error: { message?: string } | null): ActionState {
  const usernameError = usernameDbError(error?.message);
  if (usernameError) return { ok: false, error: usernameError, fieldErrors: { username: usernameError } };
  return { ok: false, error: "Gagal menyimpan profil" };
}

function invalid(error: z.ZodError): ActionState {
  const issue = error.issues[0];
  const message = issue?.message ?? "Data tidak valid";
  return issue?.path[0] === "username" ? { ok: false, error: message, fieldErrors: { username: message } } : { ok: false, error: message };
}

export async function updateOwnProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  if (check.mustChangePassword) redirect("/change-password");
  const { ownerId, memberAccountId } = check.profile;
  const supabase = createAdminSupabaseClient();

  let changes: Record<string, { from: string | null; to: string | null }> = {};
  let fullName = session.full_name;
  let targetType = "profile";
  let targetId = session.sub;

  if (memberAccountId) {
    const parsed = memberSchema.safeParse({ username: formData.get("username") });
    if (!parsed.success) return invalid(parsed.error);
    const { data: before } = await supabase.from("member_accounts").select("username").eq("id", memberAccountId).single();
    const { error } = await supabase.from("member_accounts").update({ username: parsed.data.username }).eq("id", memberAccountId);
    if (error) return failure(error);
    changes = diff(before ?? {}, { username: parsed.data.username });
    targetType = "member_account";
    targetId = memberAccountId;
  } else if (ownerId) {
    const parsed = ownerSchema.safeParse({ fullName: formData.get("fullName"), username: formData.get("username") });
    if (!parsed.success) return invalid(parsed.error);
    const after = { full_name: parsed.data.fullName, username: parsed.data.username };
    const { data: before } = await supabase.from("org_owners").select("full_name, username").eq("id", ownerId).single();
    const { error } = await supabase.from("org_owners").update(after).eq("id", ownerId);
    if (error) return failure(error);
    await supabase.from("profiles").update({ full_name: after.full_name }).eq("owner_id", ownerId);
    changes = diff(before ?? {}, after);
    fullName = after.full_name;
    targetType = "org_owner";
    targetId = ownerId;
  } else {
    const parsed = staffSchema.safeParse({
      fullName: formData.get("fullName"),
      username: formData.get("username"),
      phone: formData.get("phone") || undefined,
    });
    if (!parsed.success) return invalid(parsed.error);
    const after = { full_name: parsed.data.fullName, username: parsed.data.username, phone: parsed.data.phone || null };
    const { data: before } = await supabase.from("profiles").select("full_name, username, phone").eq("id", session.sub).single();
    const { error } = await supabase
      .from("profiles")
      .update(after)
      .eq("id", session.sub)
      .is("owner_id", null)
      .is("member_account_id", null);
    if (error) return failure(error);
    changes = diff(before ?? {}, after);
    fullName = after.full_name;
  }

  if (Object.keys(changes).length === 0) return { ok: true, message: "Tidak ada perubahan" };

  await logAudit({
    action: "profile.update",
    targetType,
    targetId,
    details: { changes },
    tenantId: session.tenant_id,
    organizationId: session.org_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });

  if (fullName !== session.full_name) {
    await createSession({
      id: session.sub,
      email: session.email,
      fullName,
      role: session.app_role,
      tenantId: session.tenant_id,
      orgId: session.org_id,
      clubPending: session.club_pending,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Profil disimpan" };
}

export async function updateSuperadminProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  let superadmin: Awaited<ReturnType<typeof requireSuperadminAction>>;
  try {
    superadmin = await requireSuperadminAction();
  } catch {
    return { ok: false, error: "Sesi Anda berakhir. Masuk ulang sebagai admin platform." };
  }

  const parsed = superadminSchema.safeParse({ fullName: formData.get("fullName"), username: formData.get("username") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createAdminSupabaseClient();
  const after = { full_name: parsed.data.fullName, username: parsed.data.username };
  const { data: before } = await supabase.from("superadmins").select("full_name, username").eq("id", superadmin.id).single();
  const { error } = await supabase.from("superadmins").update(after).eq("id", superadmin.id);
  if (error) return failure(error);

  const changes = diff(before ?? {}, after);
  if (Object.keys(changes).length === 0) return { ok: true, message: "Tidak ada perubahan" };

  await logAudit({
    action: "profile.update",
    targetType: "superadmin",
    targetId: superadmin.id,
    details: { changes },
    actorId: superadmin.id,
    actorRole: "superadmin",
    actorLabel: superadmin.email,
  });

  revalidatePath("/superadmin", "layout");
  return { ok: true, message: "Profil disimpan" };
}
