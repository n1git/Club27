import { NextResponse } from "next/server";
import { getJakartaMonthBounds } from "@/lib/format";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron";


export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { start: periodStart, end: periodEnd } = getJakartaMonthBounds();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("generate_invoices_for_period", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_date: periodEnd,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generated: (data as unknown[])?.length ?? 0 });
}
