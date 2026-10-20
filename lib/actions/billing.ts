"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { packageSchema, subscriptionSchema, generateInvoicesSchema } from "@/lib/validations/billing";
import { getJakartaDateString } from "@/lib/format";
import { type ActionState } from "./types";

export async function createPackage(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionPermission("packages.manage");
  const pricingMode = formData.get("pricingMode");
  const parsed = packageSchema.safeParse(
    pricingMode === "session_pack"
      ? {
          pricingMode: "session_pack",
          name: formData.get("name"),
          price: formData.get("price"),
          sessionsIncluded: formData.get("sessionsIncluded"),
          validityWeeks: formData.get("validityWeeks"),
          description: formData.get("description") || undefined,
        }
      : {
          pricingMode: "cycle",
          name: formData.get("name"),
          price: formData.get("price"),
          billingCycle: formData.get("billingCycle"),
          description: formData.get("description") || undefined,
        }
  );
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("membership_packages").insert(
    parsed.data.pricingMode === "session_pack"
      ? {
          name: parsed.data.name,
          price: parsed.data.price,
          pricing_mode: "session_pack",
          sessions_included: parsed.data.sessionsIncluded,
          validity_weeks: parsed.data.validityWeeks,
          description: parsed.data.description ?? null,
        }
      : {
          name: parsed.data.name,
          price: parsed.data.price,
          pricing_mode: "cycle",
          billing_period: parsed.data.billingCycle,
          description: parsed.data.description ?? null,
        }
  );
  if (error) return { ok: false, error: "Gagal menyimpan paket" };

  revalidatePath("/admin/packages");
  revalidatePath("/admin/onboarding");
  return { ok: true };
}

export async function createSubscription(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionPermission("subscriptions.manage");
  const parsed = subscriptionSchema.safeParse({
    memberId: formData.get("memberId"),
    packageId: formData.get("packageId"),
    startDate: formData.get("startDate"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("member_memberships").insert({
    member_id: parsed.data.memberId,
    package_id: parsed.data.packageId,
    start_date: parsed.data.startDate,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Anggota ini sudah memiliki langganan aktif" };
    }
    return { ok: false, error: "Gagal menyimpan langganan" };
  }

  revalidatePath("/admin/subscriptions");
  return { ok: true };
}

export async function cancelSubscription(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("subscriptions.manage");
  const subscriptionId = String(formData.get("subscriptionId"));
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("member_memberships")
    .update({ status: "cancelled", end_date: getJakartaDateString() })
    .eq("id", subscriptionId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Gagal membatalkan langganan" };
  revalidatePath("/admin/subscriptions");
  return { ok: true, message: "Langganan dibatalkan" };
}

export async function generateInvoices(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireActionPermission("invoices.manage");
  const parsed = generateInvoicesSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("generate_invoices_for_period", {
    p_period_start: parsed.data.periodStart,
    p_period_end: parsed.data.periodEnd,
    p_due_date: parsed.data.dueDate,
    p_club_id: session.club_id,
  });

  if (error) return { ok: false, error: error.code === "SW003" ? error.message : "Gagal membuat tagihan" };

  revalidatePath("/admin/invoices");
  return { ok: true, message: `${(data as unknown[])?.length ?? 0} tagihan baru dibuat` };
}

export async function markInvoicePaid(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("invoices.collect");
  const invoiceId = String(formData.get("invoiceId"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("mark_invoice_paid", { p_invoice_id: invoiceId });
  if (error) return { ok: false, error: "Gagal menandai lunas. Tagihan mungkin sudah lunas atau dibatalkan." };
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/cash");
  return { ok: true, message: "Tagihan ditandai lunas" };
}

export async function voidInvoice(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  await requireActionPermission("invoices.manage");
  const invoiceId = String(formData.get("invoiceId"));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("void_invoice", { p_invoice_id: invoiceId });
  if (error) return { ok: false, error: "Gagal membatalkan tagihan. Tagihan mungkin sudah lunas." };
  revalidatePath("/admin/invoices");
  return { ok: true, message: "Tagihan dibatalkan" };
}
