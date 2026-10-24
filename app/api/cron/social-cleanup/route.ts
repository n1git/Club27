import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron";
import { POST_MEDIA_BUCKET } from "@/lib/media/post-media";

const CHUNK = 100;

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data: files, error } = await supabase.rpc("expired_social_files", { p_now: now });
  if (error) return NextResponse.json({ error: "list failed" }, { status: 500 });

  const paths = (files ?? []) as string[];
  for (let i = 0; i < paths.length; i += CHUNK) {
    const { error: removeError } = await supabase.storage.from(POST_MEDIA_BUCKET).remove(paths.slice(i, i + CHUNK));
    if (removeError) return NextResponse.json({ error: "remove failed" }, { status: 500 });
  }

  const { data: purged, error: purgeError } = await supabase.rpc("purge_social_expired", { p_now: now });
  if (purgeError) return NextResponse.json({ error: "purge failed" }, { status: 500 });
  return NextResponse.json({ files: paths.length, purged });
}
