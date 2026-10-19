import { requirePermission } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getReadyClubTypes } from "@/lib/club-type";
import { getClubBoard, parseBoardParams } from "@/lib/data/leaderboards";
import { Leaderboard } from "@/components/social/leaderboard";
import { PageHeader } from "@/components/ui/page-header";

type Query = { metrik?: string; periode?: string; olahraga?: string };

export default async function AdminLeaderboardPage({ searchParams }: { searchParams: Promise<Query> }) {
  const user = await requirePermission("members.view_all");
  await requireModule("member_portal");
  const query = await searchParams;
  const params = parseBoardParams(query);
  const [rows, clubTypes] = await Promise.all([getClubBoard(user.tenantId, params), getReadyClubTypes()]);
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
    return qs ? `/admin/leaderboard?${qs}` : "/admin/leaderboard";
  };
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Peringkat" subtitle="Anggota yang menghubungkan akun pribadinya dan mengaktifkan peringkat klub. Hanya total yang tampil." />
      <Leaderboard rows={rows} params={params} sports={sports} hrefFor={hrefFor} />
    </div>
  );
}
