import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getReadyClubTypes } from "@/lib/club-type";
import { createGroupChallenge } from "@/lib/actions/challenges";
import { getChallengeProgress, getMyChallengeState, listVisibleChallenges } from "@/lib/data/challenges";
import { getJakartaDateString } from "@/lib/format";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { ChallengeForm } from "@/components/challenges/challenge-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const unstable_dynamicStaleTime = 0;

export default async function ChallengesPage() {
  const user = await requireRole("personal");
  if (await isSocialBanned(user.accountId)) notFound();
  const [challenges, state, clubTypes] = await Promise.all([listVisibleChallenges(), getMyChallengeState(user.accountId), getReadyClubTypes()]);
  const progress = await Promise.all(challenges.map((c) => getChallengeProgress(c.id)));
  const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
  const labels = new Map(sports.map((s) => [s.code, s.label]));
  const today = getJakartaDateString();
  const active = challenges.map((c, i) => ({ c, p: progress[i] })).filter(({ c }) => c.endsOn >= today);
  const past = challenges.map((c, i) => ({ c, p: progress[i] })).filter(({ c }) => c.endsOn < today);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tantangan" subtitle="Tantangan dari grup dan klub Anda. Ikut sukarela, progres dihitung dari catatan latihan." />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Berjalan</h2>
        {active.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {active.map(({ c, p }) => (
              <ChallengeCard key={c.id} challenge={c} progress={p} joined={state.joined.has(c.id)} today={today} sportLabel={c.sport ? labels.get(c.sport) : undefined} href={`/c/${c.id}`} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada tantangan berjalan di grup atau klub Anda.</p>
        )}
      </section>
      {state.ownedGroups.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Buat tantangan grup</CardTitle>
          </CardHeader>
          <CardContent>
            <ChallengeForm action={createGroupChallenge} groups={state.ownedGroups} sports={sports} today={today} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Pemilik grup bisa membuat tantangan untuk anggotanya.</p>
      )}
      {past.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Sudah selesai</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {past.map(({ c, p }) => (
              <ChallengeCard key={c.id} challenge={c} progress={p} joined={state.joined.has(c.id)} today={today} sportLabel={c.sport ? labels.get(c.sport) : undefined} href={`/c/${c.id}`} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
