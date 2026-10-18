"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { checkSession, sessionEndedPath } from "@/lib/auth/guard";
import { createSession, getSession } from "@/lib/auth/session";
import { requireSuperadminAction } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { addressField, nameField, phoneField } from "@/lib/validations/limits";
import { superadminUsernameSchema, usernameDbError, usernameSchema } from "@/lib/validations/username";
import type { ActionState } from "./types";

const USERNAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const accountSchema = z.object({
  fullName: nameField("Nama"),
  username: usernameSchema,
  phone: phoneField.optional(),
  address: addressField.optional(),
});
const organizationSchema = z.object({ organizationId: z.string().uuid(), name: nameField("Nama organisasi") });
const coachSchema = z.object({
  profileId: z.string().uuid(),
  specialization: z.string().trim().max(200, "Spesialisasi terlalu panjang").optional(),
});
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

async function activeSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  const check = await checkSession(session);
  if (!check.ok) redirect(sessionEndedPath(check.reason));
  if (check.mustChangePassword) redirect("/change-password");
  return session;
}

export async function updateOwnProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await activeSession();
  const supabase = createAdminSupabaseClient();

  const parsed = accountSchema.safeParse({
    fullName: formData.get("fullName"),
    username: formData.get("username"),
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);
  const values = parsed.data;

  const { data: account } = await supabase
    .from("accounts")
    .select("full_name, username, phone, address, username_changed_at")
    .eq("id", session.account_id)
    .single();
  const usernameChanged = Boolean(account) && account!.username !== values.username;
  if (usernameChanged && account!.username_changed_at && Date.now() - new Date(account!.username_changed_at as string).getTime() < USERNAME_COOLDOWN_MS) {
    return { ok: false, error: "Username hanya bisa diubah sekali dalam 30 hari", fieldErrors: { username: "Username hanya bisa diubah sekali dalam 30 hari" } };
  }
  const after: Values = {
    full_name: values.fullName,
    username: values.username,
    phone: values.phone || null,
    address: values.address || null,
  };
  const { error } = await supabase
    .from("accounts")
    .update(usernameChanged ? { ...after, username_changed_at: new Date().toISOString() } : after)
    .eq("id", session.account_id);
  if (error) return failure(error);
  const changes = diff(account ?? {}, after);
  if (Object.keys(changes).length === 0) return { ok: true, message: "Tidak ada perubahan" };

  const { data: owners } = await supabase.from("organization_users").select("id").eq("account_id", session.account_id);
  const ownerIds = (owners ?? []).map((o) => o.id as string);
  if (ownerIds.length) {
    await supabase.from("organization_users").update({ full_name: values.fullName }).in("id", ownerIds);
    await supabase.from("club_profiles").update({ full_name: values.fullName, phone: values.phone || null }).in("owner_id", ownerIds);
  }
  await supabase
    .from("club_profiles")
    .update({ full_name: values.fullName, phone: values.phone || null })
    .eq("account_id", session.account_id)
    .neq("role", "member");

  await logAudit({
    action: "profile.update",
    targetType: "account",
    targetId: session.account_id,
    details: { changes },
    tenantId: session.club_id,
    organizationId: session.org_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });

  if (values.fullName !== session.full_name) {
    await createSession({
      id: session.sub,
      accountId: session.account_id,
      email: session.email,
      fullName: values.fullName,
      role: session.app_role,
      tenantId: session.club_id,
      orgId: session.org_id,
      clubPending: session.club_pending,
    });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Profil disimpan" };
}

export async function updateOrganizationName(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await activeSession();
  const parsed = organizationSchema.safeParse({ organizationId: formData.get("organizationId"), name: formData.get("name") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createAdminSupabaseClient();
  const { data: membership } = await supabase
    .from("organization_users")
    .select("id")
    .eq("account_id", session.account_id)
    .eq("organization_id", parsed.data.organizationId)
    .eq("is_active", true)
    .in("base_role", ["p_owner", "owner"])
    .maybeSingle();
  if (!membership) return { ok: false, error: "Hanya pemilik organisasi yang bisa mengubah data ini" };

  const { data: before } = await supabase.from("organizations").select("name").eq("id", parsed.data.organizationId).single();
  if (before?.name === parsed.data.name) return { ok: true, message: "Tidak ada perubahan" };
  const { error } = await supabase.from("organizations").update({ name: parsed.data.name }).eq("id", parsed.data.organizationId);
  if (error) return { ok: false, error: "Gagal menyimpan data organisasi" };

  await logAudit({
    action: "organization.update",
    targetType: "organization",
    targetId: parsed.data.organizationId,
    details: { changes: { name: { from: before?.name ?? null, to: parsed.data.name } } },
    organizationId: parsed.data.organizationId,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Data organisasi disimpan" };
}

export async function updateCoachProfile(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await activeSession();
  const parsed = coachSchema.safeParse({
    profileId: formData.get("profileId"),
    specialization: formData.get("specialization") || undefined,
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = createAdminSupabaseClient();
  const { data: profile } = await supabase
    .from("club_profiles")
    .select("id, club_id, specialization")
    .eq("id", parsed.data.profileId)
    .eq("account_id", session.account_id)
    .is("owner_id", null)
    .neq("role", "member")
    .eq("is_active", true)
    .maybeSingle();
  const { data: granted } = profile ? await supabase.rpc("profile_permissions", { p_profile: profile.id }) : { data: null };
  if (!profile || !((granted as string[] | null) ?? []).includes("classes.instruct")) {
    return { ok: false, error: "Anda bukan pelatih di klub ini" };
  }

  const specialization = parsed.data.specialization || null;
  if ((profile.specialization ?? null) === specialization) return { ok: true, message: "Tidak ada perubahan" };
  const { error } = await supabase.from("club_profiles").update({ specialization }).eq("id", profile.id);
  if (error) return { ok: false, error: "Gagal menyimpan profil pelatih" };

  await logAudit({
    action: "profile.update",
    targetType: "coach_profile",
    targetId: profile.id,
    details: { changes: { specialization: { from: profile.specialization ?? null, to: specialization } } },
    tenantId: profile.club_id,
    actorId: session.sub,
    actorRole: session.app_role,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Profil pelatih disimpan" };
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
