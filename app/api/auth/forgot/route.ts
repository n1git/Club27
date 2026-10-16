import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createPasswordReset } from "@/lib/accounts/password-reset";
import { isKeyRateLimited, isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";
import { isEmailConfigured } from "@/lib/email";

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  }
  if (await isRateLimited(request, "forgot", 10, 3600, true)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }
  const parsed = forgotSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email tidak valid" }, { status: 400 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "Pengiriman email belum aktif. Hubungi admin klub atau admin platform." }, { status: 503 });
  }

  const { email } = parsed.data;
  if (await isKeyRateLimited(`forgot-email:${email}`, 3, 3600, true)) {
    return NextResponse.json({ ok: true });
  }
  const { data: account } = await createAdminSupabaseClient()
    .from("accounts")
    .select("id, email, full_name")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();
  if (account) await createPasswordReset(account as { id: string; email: string; full_name: string });
  return NextResponse.json({ ok: true });
}
