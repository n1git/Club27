import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/cron";
import { formatJakartaDate, getJakartaDateString } from "@/lib/format";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { APP_NAME } from "@/lib/config";
import { SITE_URL } from "@/lib/site";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDERS = [
  { kind: "h7", days: 7 },
  { kind: "h1", days: 1 },
] as const;

function addDays(date: string, days: number) {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function reminderEmail(dueDate: string, trial: boolean) {
  const link = `${SITE_URL}/admin/klub/langganan`;
  const what = trial ? "Masa trial" : "Langganan";
  const date = formatJakartaDate(dueDate, { day: "numeric", month: "long", year: "numeric" });
  return {
    subject: `${what} ${APP_NAME} berakhir ${date}`,
    text: `${what} organisasi Anda di ${APP_NAME} berakhir ${date}. Setelah itu data hanya bisa dibaca sampai langganan diperpanjang.\n\nAjukan perpanjangan di ${link}`,
    html: `<p>${what} organisasi Anda di ${APP_NAME} berakhir <strong>${date}</strong>. Setelah itu data hanya bisa dibaca sampai langganan diperpanjang.</p><p><a href="${link}">Ajukan perpanjangan</a></p>`,
  };
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: expired, error } = await supabase.rpc("expire_subscriptions");
  if (error) return NextResponse.json({ error: "expire failed" }, { status: 500 });

  if (!isEmailConfigured()) return NextResponse.json({ expired, reminders: 0 });

  const today = getJakartaDateString();
  let reminders = 0;
  for (const reminder of REMINDERS) {
    const dueDate = addDays(today, reminder.days);
    const { data: due } = await supabase
      .from("organization_subscriptions")
      .select("organization_id, status")
      .or(`and(status.eq.active,current_period_end.eq.${dueDate}),and(status.eq.trial,trial_ends_at.eq.${dueDate})`);
    for (const row of due ?? []) {
      const { data: claimed } = await supabase
        .from("subscription_reminders")
        .upsert({ organization_id: row.organization_id, due_date: dueDate, kind: reminder.kind }, { ignoreDuplicates: true })
        .select("organization_id");
      if (!claimed?.length) continue;
      const { data: owners } = await supabase
        .from("organization_users")
        .select("email")
        .eq("organization_id", row.organization_id)
        .in("base_role", ["p_owner", "owner"])
        .eq("is_active", true);
      for (const owner of owners ?? []) {
        if (await sendEmail({ to: owner.email, ...reminderEmail(dueDate, row.status === "trial") })) reminders += 1;
      }
    }
  }

  return NextResponse.json({ expired, reminders });
}
