import { notFound } from "next/navigation";
import Link from "next/link";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getMyGroups } from "@/lib/data/groups";
import { respondGroupInvite } from "@/lib/actions/groups";
import { ActionButton } from "@/components/shared/action-button";
import { GroupCreateForm } from "@/components/groups/group-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function GroupsPage() {
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const groups = await getMyGroups(profile.accountId);
  const invites = groups.filter((g) => g.status === "invited");
  const active = groups.filter((g) => g.status === "active");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Grup" subtitle="Grup bersifat privat: hanya teman yang bisa diundang, dan hanya anggota yang melihat anggota dan event." />
      {invites.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Undangan ({invites.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {invites.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex flex-col">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-xs text-muted-foreground">Dari {g.owner?.fullName ?? "pengguna"}</span>
                  </span>
                  <span className="flex gap-2">
                    <ActionButton action={respondGroupInvite} fields={{ groupId: g.id, accept: "1" }} label="Terima" variant="default" />
                    <ActionButton action={respondGroupInvite} fields={{ groupId: g.id, accept: "0" }} label="Tolak" />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Grup Anda ({active.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada grup.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {active.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={`/home/groups/${g.id}`} className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                    {g.name}
                  </Link>
                  {g.isOwner ? <Badge variant="secondary">Pemilik</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Buat grup</CardTitle>
        </CardHeader>
        <CardContent>
          <GroupCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
