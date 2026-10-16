import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth/password";
import { isRateLimited, RATE_LIMIT_ERROR } from "@/lib/auth/rate-limit";
import { isCrossSite, readJsonBody } from "@/lib/auth/request";
import { passwordSchema } from "@/lib/validations/auth";
import { hashToken, TOKEN_PATTERN } from "@/lib/accounts/tokens";
import { logAudit } from "@/lib/audit";

const resetSchema = z.object({ token: z.string().regex(TOKEN_PATTERN), password: passwordSchema });
const INVALID = "Tautan tidak berlaku lagi. Minta tautan baru.";

export async function POST(request: Request) {
  if (isCrossSite(request)) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  }
  if (await isRateLimited(request, "reset", 10, 3600, true)) {
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }
  const parsed = resetSchema.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "password");
    return NextResponse.json({ error: issue?.message ?? INVALID }, { status: 400 });
  }

  const { data } = await createAdminSupabaseClient().rpc("consume_password_reset", {
    p_token_hash: hashToken(parsed.data.token),
    p_password_hash: await hashPassword(parsed.data.password),
  });
  const row = (data as { out_account_id: string }[] | null)?.[0];
  if (!row) return NextResponse.json({ error: INVALID }, { status: 400 });

  await logAudit({
    action: "password.reset_by_link",
    targetType: "account",
    targetId: row.out_account_id,
    actorId: row.out_account_id,
    actorRole: "account",
  });
  return NextResponse.json({ ok: true, redirectTo: "/login?diatur=1" });
}
