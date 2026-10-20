import Link from "next/link";
import { requireValidSession } from "@/lib/auth/guard";
import { listContexts, listInactiveClubs, listPendingDeletions } from "@/lib/auth/contexts";
import { getWorkoutData } from "@/lib/data/workouts";
import { getFeed } from "@/lib/data/social";
import { isSocialBanned } from "@/lib/auth/social-access";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getUpcomingEvents } from "@/lib/data/groups";
import { formatJakartaDateTime } from "@/lib/format";
import { getReadyClubTypes } from "@/lib/club-type";
import { PostCard } from "@/components/social/post-card";
import { PostComposer } from "@/components/social/post-composer";
import { ContextList } from "@/components/shared/context-list";
import { PendingDeletions } from "@/components/shared/pending-deletions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export async function PersonalHomePage({ searchParams }: { searchParams: Promise<{ sebelum?: string }> }) {
  const { profile } = await requireValidSession();
  const { sebelum } = await searchParams;
  const before = sebelum && !Number.isNaN(Date.parse(sebelum)) ? sebelum : undefined;
  const banned = await isSocialBanned(profile.accountId);
  const [{ entries }, deletions, workouts, feed, clubTypes, upcoming, inactive] = await Promise.all([
    listContexts(profile.accountId),
    listPendingDeletions(profile.accountId),
    getWorkoutData(),
    banned ? Promise.resolve({ posts: [], hasMore: false }) : getFeed(profile.accountId, before),
    getReadyClubTypes(),
    banned ? Promise.resolve([]) : getUpcomingEvents(),
    listInactiveClubs(profile.accountId),
  ]);
  const sportLabels = Object.fromEntries(clubTypes.map((t) => [t.code, t.name.replace(/^Klub\s+/, "")]));
  const week = workouts.weeks[workouts.weeks.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PendingDeletions items={deletions} />
      <PageHeader title="Beranda" subtitle={`Halo, ${profile.fullName}`} />
      {inactive.length ? (
        <Alert>
          <AlertDescription>
            Akses Anda ke {inactive.join(", ")} sedang dinonaktifkan. Data tetap tersimpan. Hubungi admin klub atau admin platform untuk mengaktifkannya kembali.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latihan minggu ini</CardTitle>
            <CardDescription>
              {workouts.weeklyGoal ? `${week.sessions} dari target ${workouts.weeklyGoal} sesi` : `${week.sessions} sesi, ${week.minutes} menit`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/workouts" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Catat latihan
            </Link>
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
      </div>
      {upcoming.length ? (
        <Card className="max-w-2xl">
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
      {banned ? null : (
      <section className="flex max-w-2xl flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">Feed teman</h2>
        <Card>
          <CardContent className="pt-5">
            <PostComposer />
          </CardContent>
        </Card>
        {feed.posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada postingan. <Link href="/friends" className="font-medium text-accent-foreground underline-offset-4 hover:underline">Tambah teman</Link> untuk melihat aktivitas mereka.
          </p>
        ) : (
          feed.posts.map((post) => <PostCard key={post.id} post={post} sportLabels={sportLabels} />)
        )}
        {feed.hasMore ? (
          <Link
            href={`/?sebelum=${encodeURIComponent(feed.posts[feed.posts.length - 1].createdAt)}`}
            className={buttonVariants({ variant: "outline", size: "sm" }) + " w-fit"}
          >
            Postingan sebelumnya
          </Link>
        ) : null}
      </section>
      )}
    </div>
  );
}
