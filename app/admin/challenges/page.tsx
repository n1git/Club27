import { requirePermission } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getReadyClubTypes } from "@/lib/club-type";
import { createClubChallenge, deleteClubChallenge } from "@/lib/actions/challenges";
import { getChallengeProgress, listVisibleChallenges } from "@/lib/data/challenges";
import { getJakartaDateString } from "@/lib/format";
import { ChallengePeriod, ProgressTable } from "@/components/challenges/challenge-card";
import { ChallengeForm } from "@/components/challenges/challenge-form";
import { ActionButton } from "@/components/shared/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const unstable_dynamicStaleTime = 0;

export default async function AdminChallengesPage() {
  const user = await requirePermission("challenges.manage");
  await requireModule("member_portal");
  const [challenges, clubTypes] = await Promise.all([listVisibleChallenges(user.tenantId), getReadyClubTypes()]);
  const progress = await Promise.all(challenges.map((c) => getChallengeProgress(c.id)));
  const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
  const labels = new Map(sports.map((s) => [s.code, s.label]));
  const today = getJakartaDateString();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tantangan" subtitle="Tantangan untuk anggota yang menghubungkan akun pribadinya. Anggota ikut secara sukarela." />
      <Card>
        <CardHeader>
          <CardTitle>Buat tantangan klub</CardTitle>
        </CardHeader>
        <CardContent>
          <ChallengeForm action={createClubChallenge} sports={sports} today={today} />
        </CardContent>
      </Card>
      {challenges.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada tantangan klub.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {challenges.map((c, i) => (
            <li key={c.id} className="rounded-2xl border border-border bg-card p-4">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-col">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      <ChallengePeriod challenge={c} sportLabel={c.sport ? labels.get(c.sport) : undefined} /> · {progress[i].length} peserta ·{" "}
                      {progress[i].filter((p) => p.done).length} selesai{c.endsOn < today ? " · Berakhir" : ""}
                    </span>
                  </span>
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  <ProgressTable challenge={c} progress={progress[i]} />
                  <div>
                    <ActionButton action={deleteClubChallenge} fields={{ challengeId: c.id }} label="Hapus" variant="destructive" confirmMessage="Hapus tantangan ini?" />
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
