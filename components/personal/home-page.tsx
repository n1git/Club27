import Link from "next/link";
import { Suspense } from "react";
import { requireValidSession } from "@/lib/auth/guard";
import { listContexts, listInactiveClubs, listPendingDeletions } from "@/lib/auth/contexts";
import { getWorkoutData } from "@/lib/data/workouts";
import { isSocialBanned } from "@/lib/auth/social-access";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getUpcomingEvents } from "@/lib/data/groups";
import { formatJakartaDateTime } from "@/lib/format";
import { HomeFeed } from "@/components/personal/home-feed";
import { HomeStories, StoriesBarSkeleton } from "@/components/personal/home-stories";
import { FeedSkeleton } from "@/components/social/post-skeleton";
import { QuickAddTrigger } from "@/components/personal/quick-add";
import { ContextList } from "@/components/shared/context-list";
import { PendingDeletions } from "@/components/shared/pending-deletions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export async function PersonalHomePage({ searchParams }: { searchParams: Promise<{ sebelum?: string }> }) {
  const { profile } = await requireValidSession();
  const { sebelum } = await searchParams;
  const before = sebelum && !Number.isNaN(Date.parse(sebelum)) ? sebelum : undefined;
  const banned = await isSocialBanned(profile.accountId);
  const [{ entries }, deletions, workouts, upcoming, inactive] = await Promise.all([
    listContexts(profile.accountId),
    listPendingDeletions(profile.accountId),
    getWorkoutData(),
    banned ? Promise.resolve([]) : getUpcomingEvents(),
    listInactiveClubs(profile.accountId),
  ]);
  const week = workouts.weeks[workouts.weeks.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PendingDeletions items={deletions} />
      <div className="hidden sm:block">
        <PageHeader title="Beranda" subtitle={`Halo, ${profile.fullName}`} />
      </div>
      {inactive.length ? (
        <Alert>
          <AlertDescription>
            Akses Anda ke {inactive.join(", ")} sedang dinonaktifkan. Data tetap tersimpan. Hubungi admin klub atau admin platform untuk mengaktifkannya kembali.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className={banned ? "flex flex-col gap-6" : "grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]"}>
        {banned ? null : (
          <div className="-mx-4 flex min-w-0 flex-col sm:mx-0">
            <Suspense fallback={<StoriesBarSkeleton />}>
              <HomeStories accountId={profile.accountId} name={profile.fullName} />
            </Suspense>
            <Suspense fallback={<FeedSkeleton />}>
              <HomeFeed accountId={profile.accountId} before={before} />
            </Suspense>
          </div>
        )}
        <div className={banned ? "flex max-w-2xl flex-col gap-4" : "flex flex-col gap-4 lg:col-start-2 lg:row-start-1"}>
          <Card>
            <CardHeader>
              <CardTitle>Latihan minggu ini</CardTitle>
              <CardDescription>
                {workouts.weeklyGoal ? `${week.sessions} dari target ${workouts.weeklyGoal} sesi` : `${week.sessions} sesi, ${week.minutes} menit`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuickAddTrigger kind="workout" variant="outline" size="sm">
                Catat latihan
              </QuickAddTrigger>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Klub dan organisasi</CardTitle>
              <CardDescription>
                {entries.length ? "Pilih yang ingin Anda buka." : "Anda belum tergabung di klub mana pun."}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {entries.length ? (
                <ContextList options={entries.map((e) => ({ key: e.key, label: e.label, detail: e.detail }))} />
              ) : (
                <>
                  <Link href="/join" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                    Gabung klub
                  </Link>{" "}
                  dengan kode dari admin klub, atau{" "}
                  <Link href="/upgrade" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                    buat klub sendiri
                  </Link>
                  .
                </>
              )}
            </CardContent>
          </Card>
          {upcoming.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Event mendatang</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {upcoming.map((e) => (
                    <li key={e.id}>
                      <Link href={`/g/${e.groupId}`} className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                        {e.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {e.groupName} · {formatJakartaDateTime(e.startsAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
