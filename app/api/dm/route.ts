import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { checkSession } from "@/lib/auth/guard";
import { isKeyRateLimited } from "@/lib/auth/rate-limit";
import { isSocialBanned } from "@/lib/auth/social-access";
import { loadThread } from "@/lib/data/messages";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.app_role !== "personal") return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403, headers: NO_STORE });
  const check = await checkSession(session);
  if (!check.ok || check.mustChangePassword) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401, headers: NO_STORE });
  if (await isSocialBanned(session.account_id)) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403, headers: NO_STORE });
  if (await isKeyRateLimited(`dm-poll:${session.account_id}`, 90, 60)) return NextResponse.json({ error: "Terlalu sering" }, { status: 429, headers: NO_STORE });
  const username = new URL(request.url).searchParams.get("u")?.toLowerCase() ?? "";
  const thread = await loadThread(username, session.account_id);
  if (!thread) return NextResponse.json({ error: "Tidak ditemukan" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(thread, { headers: NO_STORE });
}
