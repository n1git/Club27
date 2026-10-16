import { NextResponse } from "next/server";
import { isCrossSite } from "@/lib/auth/request";
import { clearSession, getSession } from "@/lib/auth/session";
import { revokeAccountSessions } from "@/lib/accounts/account";

export async function POST(request: Request) {
  if (isCrossSite(request)) return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 403 });
  const session = await getSession();
  if (session?.account_id) await revokeAccountSessions(session.account_id);
  await clearSession();
  return NextResponse.json({ ok: true });
}
