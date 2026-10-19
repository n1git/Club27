import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getReadyClubTypes } from "@/lib/club-type";
import { getClubBoard, getMyBoardClubs, parseBoardParams } from "@/lib/data/leaderboards";
import { Leaderboard } from "@/components/social/leaderboard";
import { LeaderboardOptin } from "@/components/social/leaderboard-optin";
import { PageHeader } from "@/components/ui/page-header";

type Query = { metrik?: string; periode?: string; olahraga?: string };

export default async function MemberLeaderboardPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requireRole("member");
  if (user.clubPending) redirect("/member/clubs");
  await requireModule("member_portal");
  const query = await searchParams;
  const params = parseBoardParams(query);
  const [rows, clubTypes, clubs] = await Promise.all([getClubBoard(user.tenantId, params), getReadyClubTypes(), getMyBoardClubs()]);
  const club = clubs.find((c) => c.clubId === user.tenantId);
  const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
  const hrefFor = (patch: { metrik?: string; periode?: string; olahraga?: string | null }) => {
    const next = new URLSearchParams();
    const metrik = patch.metrik ?? query.metrik;
    const periode = patch.periode ?? query.periode;
    const olahraga = patch.olahraga === undefined ? query.olahraga : patch.olahraga;
    if (metrik) next.set("metrik", metrik);
    if (periode) next.set("periode", periode);
    if (olahraga) next.set("olahraga", olahraga);
    const qs = next.toString();
    return qs ? `/member/leaderboard?${qs}` : "/member/leaderboard";
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Peringkat klub" subtitle="Hanya anggota yang mengaktifkannya yang tampil." />
      {club ? <LeaderboardOptin club={club} /> : null}
      <Leaderboard rows={rows} params={params} sports={sports} hrefFor={hrefFor} />
    </div>
  );
}
