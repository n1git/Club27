import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { checkSession } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { socialRestriction } from "@/lib/auth/social-access";
import { getGroupBoard, METRIC_LABEL, parseBoardParams, PERIOD_LABEL } from "@/lib/data/leaderboards";
import { computeRecords } from "@/lib/data/workouts";
import { formatJakartaDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SIZE = { width: 1080, height: 1350 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Card = { title: string; value: string; detail: string };

function km(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 2 })} km` : `${m} m`;
}

function day(d: string) {
  return formatJakartaDate(`${d}T00:00:00+07:00`, { dateStyle: "long" });
}

async function sportName(code: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("club_types").select("name").eq("code", code).maybeSingle();
  return ((data?.name as string | undefined) ?? code).replace(/^Klub\s+/, "");
}

async function build(kind: string, id: string, search: URLSearchParams): Promise<Card | null> {
  const supabase = await createServerSupabaseClient();
  if (kind === "workout" && UUID.test(id)) {
    const { data } = await supabase.from("workout_logs").select("sport, performed_on, duration_min, distance_m").eq("id", id).maybeSingle();
    if (!data) return null;
    return {
      title: `Latihan ${await sportName(data.sport as string)}`,
      value: data.distance_m ? km(data.distance_m as number) : `${data.duration_min} menit`,
      detail: `${data.distance_m ? `${data.duration_min} menit · ` : ""}${day(data.performed_on as string)}`,
    };
  }
  if (kind === "badge" && UUID.test(id)) {
    const { data } = await supabase.from("achievements").select("earned_on, achievement_types(name, description)").eq("id", id).maybeSingle();
    const type = (Array.isArray(data?.achievement_types) ? data?.achievement_types[0] : data?.achievement_types) as { name: string; description: string } | null | undefined;
    if (!data || !type) return null;
    return { title: "Lencana baru", value: type.name, detail: `${type.description} · ${day(data.earned_on as string)}` };
  }
  if (kind === "record") {
    const match = /^([a-z_]{2,30})-(\d{4})$/.exec(id);
    const metric = search.get("m");
    if (!match || !["distance", "duration", "pace"].includes(metric ?? "")) return null;
    const { data } = await supabase.from("workout_logs").select("performed_on, sport, duration_min, distance_m").eq("sport", match[1]).gte("performed_on", `${match[2]}-01-01`).lte("performed_on", `${match[2]}-12-31`).limit(10000);
    const rec = computeRecords((data ?? []) as { performed_on: string; sport: string; duration_min: number; distance_m: number | null }[])[0];
    if (!rec) return null;
    const sport = await sportName(match[1]);
    if (metric === "distance" && rec.longestDistance) return { title: `Jarak terjauh ${sport} ${match[2]}`, value: km(rec.longestDistance.meters), detail: day(rec.longestDistance.on) };
    if (metric === "duration" && rec.longestDuration) return { title: `Durasi terlama ${sport} ${match[2]}`, value: `${rec.longestDuration.minutes} menit`, detail: day(rec.longestDuration.on) };
    if (metric === "pace" && rec.bestPace) {
      const total = Math.round(rec.bestPace.minPerKm * 60);
      return { title: `Pace terbaik ${sport} ${match[2]}`, value: `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} /km`, detail: day(rec.bestPace.on) };
    }
    return null;
  }
  if (kind === "rank" && UUID.test(id)) {
    const params = parseBoardParams({ metrik: search.get("metrik") ?? undefined, periode: search.get("periode") ?? undefined });
    const me = (await getGroupBoard(id, params)).find((r) => r.isMe && r.rank !== null);
    if (!me) return null;
    const { data: group } = await supabase.from("groups").select("name").eq("id", id).maybeSingle();
    return { title: `Peringkat ${(group?.name as string | undefined) ?? "grup"}`, value: `#${me.rank}`, detail: `${METRIC_LABEL[params.metric]} · ${PERIOD_LABEL[params.period]}` };
  }
  return null;
}

export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await getSession();
  if (!session?.account_id) return new Response("Tidak ditemukan", { status: 404 });
  const check = await checkSession(session);
  if (!check.ok || (await socialRestriction(session.account_id))) return new Response("Tidak ditemukan", { status: 404 });
  const { kind, id } = await params;
  const card = await build(kind, id, new URL(request.url).searchParams);
  if (!card) return new Response("Tidak ditemukan", { status: 404 });
  const { data: account } = await (await createServerSupabaseClient()).from("social_people").select("username").eq("id", session.account_id).maybeSingle();
  const logo = await readFile(join(process.cwd(), "public/brand/ruzz-italic-lockup-white-transparent.svg"), "base64");

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 88, background: "#111214", color: "#f2f2ee" }}>
        <img src={`data:image/svg+xml;base64,${logo}`} alt="" width={318} height={72} />
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 48, color: "#FFD21F", fontWeight: 700 }}>{card.title}</div>
          <div style={{ fontSize: card.value.length > 12 ? 120 : 180, fontWeight: 800, lineHeight: 1 }}>{card.value}</div>
          <div style={{ fontSize: 40, color: "#a6a7ab" }}>{card.detail}</div>
        </div>
        <div style={{ fontSize: 44, fontWeight: 700 }}>{`@${(account?.username as string | undefined) ?? ""}`}</div>
      </div>
    ),
    SIZE
  );
  image.headers.set("Cache-Control", "private, no-store");
  return image;
}
