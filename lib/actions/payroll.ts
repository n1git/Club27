"use server";

import { revalidatePath } from "next/cache";
import { requireActionPermission } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { payrollRunSchema, payrollPreviewSchema } from "@/lib/validations/payroll";
import { parseJakartaLocalInput } from "@/lib/format";
import { type ActionState } from "./types";

export async function createPayrollRun(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireActionPermission("payroll.manage");

  const parsed = payrollRunSchema.safeParse({
    coachId: formData.get("coachId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    baseSalary: formData.get("baseSalary"),
    bonus: formData.get("bonus") || 0,
    thr: formData.get("thr") || 0,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }
  const input = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_payroll_run", {
    p_coach_id: input.coachId,
    p_period_start: input.periodStart,
    p_period_end: input.periodEnd,
    p_base_salary: input.baseSalary,
    p_bonus: input.bonus,
    p_thr: input.thr,
  });

  if (error) {
    if (error.code === "SW003") return { ok: false, error: error.message };
    if (error.code === "23505") {
      return { ok: false, error: "Gaji untuk pelatih dan periode ini sudah pernah dibuat" };
    }
    return { ok: false, error: "Gagal membuat gaji" };
  }

  revalidatePath("/admin/payroll");
  revalidatePath("/admin/cash-ledger");
  return { ok: true };
}

export interface PayrollSessionPreview {
  sessions: number;
  rate: number | null;
}

export async function previewPayrollSessions(
  coachId: string,
  periodStart: string,
  periodEnd: string
): Promise<PayrollSessionPreview | null> {
  await requireActionPermission("payroll.manage");
  const parsed = payrollPreviewSchema.safeParse({ coachId, periodStart, periodEnd });
  if (!parsed.success) return null;

  const from = parseJakartaLocalInput(`${parsed.data.periodStart}T00:00`);
  const until = new Date(Date.parse(parseJakartaLocalInput(`${parsed.data.periodEnd}T00:00`)) + 24 * 60 * 60 * 1000).toISOString();
  const id = parsed.data.coachId;

  const supabase = await createServerSupabaseClient();
  const [{ data: coach }, { count }] = await Promise.all([
    supabase.from("instructors").select("session_rate").eq("id", id).maybeSingle(),
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .or(`substitute_id.eq.${id},and(instructor_id.eq.${id},substitute_id.is.null)`)
      .gte("start_time", from)
      .lt("start_time", until),
  ]);
  if (!coach) return null;
  return { sessions: count ?? 0, rate: coach.session_rate === null ? null : Number(coach.session_rate) };
}
