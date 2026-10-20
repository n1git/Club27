import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getReadyClubTypes } from "@/lib/club-type";
import { deleteGroupChallenge } from "@/lib/actions/challenges";
import { formatChallengeValue, getChallenge, getChallengeProgress, getMyChallengeState } from "@/lib/data/challenges";
import { getJakartaDateString } from "@/lib/format";
import { ChallengeCard, ProgressTable } from "@/components/challenges/challenge-card";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/ui/page-header";

export const unstable_dynamicStaleTime = 0;

export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("personal");
  if (await isSocialBanned(user.accountId)) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [challenge, progress, state, clubTypes] = await Promise.all([getChallenge(id), getChallengeProgress(id), getMyChallengeState(user.accountId), getReadyClubTypes()]);
  if (!challenge) notFound();
  const sportLabel = challenge.sport ? clubTypes.find((t) => t.code === challenge.sport)?.name.replace(/^Klub\s+/, "") : undefined;
  const owner = challenge.groupId ? state.ownedGroups.some((g) => g.id === challenge.groupId) : false;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={challenge.name} subtitle={`${challenge.scopeName} · Target ${formatChallengeValue(challenge.target, challenge.metric)}`} />
      <ul>
        <ChallengeCard challenge={challenge} progress={progress} joined={state.joined.has(challenge.id)} today={getJakartaDateString()} sportLabel={sportLabel} href={`/home/challenges/${challenge.id}`} />
      </ul>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Peserta</h2>
        <ProgressTable challenge={challenge} progress={progress} />
      </section>
      {owner ? (
        <div>
          <ActionButton action={deleteGroupChallenge} fields={{ challengeId: challenge.id }} label="Hapus tantangan" variant="destructive" confirmMessage="Hapus tantangan ini untuk semua peserta?" />
        </div>
      ) : null}
    </div>
  );
}
