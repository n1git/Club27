import Link from "next/link";
import { requireValidSession } from "@/lib/auth/guard";
import { listContexts, listPendingDeletions } from "@/lib/auth/contexts";
import { getWorkoutData } from "@/lib/data/workouts";
import { ContextList } from "@/components/shared/context-list";
import { PendingDeletions } from "@/components/shared/pending-deletions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function PersonalHomePage() {
  const { profile, session } = await requireValidSession();
  const [{ entries }, deletions, workouts] = await Promise.all([
    listContexts(profile.accountId),
    listPendingDeletions(profile.accountId),
    getWorkoutData(),
  ]);
  const week = workouts.weeks[workouts.weeks.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PendingDeletions items={deletions} />
      <PageHeader title="Beranda" subtitle={`Halo, ${profile.fullName}`} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Latihan minggu ini</CardTitle>
            <CardDescription>
              {workouts.weeklyGoal ? `${week.sessions} dari target ${workouts.weeklyGoal} sesi` : `${week.sessions} sesi, ${week.minutes} menit`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/akun/latihan" className={buttonVariants({ variant: "outline", size: "sm" })}>
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
                Minta admin klub mengaktifkan akun anggota Anda memakai email {session.email}, atau{" "}
                <Link href="/akun/upgrade" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                  buat klub sendiri
                </Link>
                .
              </>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Feed teman</CardTitle>
            <CardDescription>Segera hadir: lihat aktivitas latihan teman Anda.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
