import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { checkSession, permissionsFor } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildMemberExport, jsonDownload } from "@/lib/data/member-export";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !(await permissionsFor(session)).has("members.privacy")) return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  const check = await checkSession(session);
  if (!check.ok || check.mustChangePassword) return NextResponse.json({ error: "Sesi tidak valid" }, { status: 401 });

  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  const data = await buildMemberExport(await createServerSupabaseClient(), id.data);
  if (!data) return NextResponse.json({ error: "Anggota tidak ditemukan" }, { status: 404 });
  return jsonDownload(data, `anggota-${id.data}.json`);
}
