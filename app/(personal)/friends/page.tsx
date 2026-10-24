import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getFriendLists, type Person } from "@/lib/data/social";
import { blockAccount, removeFriend, respondFriend, unblockAccount } from "@/lib/actions/social";
import { ActionButton } from "@/components/shared/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

function PersonLine({ person, children }: { person: Person; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="flex flex-col">
        <span className="font-medium">{person.fullName}</span>
        <span className="text-xs text-muted-foreground">@{person.username}</span>
      </span>
      <span className="flex flex-wrap gap-2">{children}</span>
    </li>
  );
}

function Section({ title, empty, children, count }: { title: string; empty: string; children: React.ReactNode; count: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({count})
        </CardTitle>
      </CardHeader>
      <CardContent>{count ? <ul className="flex flex-col gap-3">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}</CardContent>
    </Card>
  );
}

export default async function FriendsPage() {
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const lists = await getFriendLists(profile.accountId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Teman" subtitle="Postingan Anda hanya terlihat oleh teman. Tambah teman dengan username yang persis sama." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section title="Permintaan masuk" count={lists.incoming.length} empty="Tidak ada permintaan.">
          {lists.incoming.map((r) => (
            <PersonLine key={r.friendshipId} person={r.person}>
              <ActionButton action={respondFriend} fields={{ friendshipId: r.friendshipId, accept: "1" }} label="Terima" variant="default" />
              <ActionButton action={respondFriend} fields={{ friendshipId: r.friendshipId, accept: "0" }} label="Tolak" />
            </PersonLine>
          ))}
        </Section>
        <Section title="Permintaan terkirim" count={lists.outgoing.length} empty="Tidak ada permintaan terkirim.">
          {lists.outgoing.map((r) => (
            <PersonLine key={r.friendshipId} person={r.person}>
              <ActionButton action={removeFriend} fields={{ accountId: r.person.id }} label="Batalkan" />
            </PersonLine>
          ))}
        </Section>
        <Section title="Teman" count={lists.friends.length} empty="Belum ada teman.">
          {lists.friends.map((r) => (
            <PersonLine key={r.friendshipId} person={r.person}>
              <ActionButton action={removeFriend} fields={{ accountId: r.person.id }} label="Hapus" confirmMessage={`Hapus ${r.person.fullName} dari teman?`} />
              <ActionButton
                action={blockAccount}
                fields={{ accountId: r.person.id }}
                label="Blokir"
                variant="ghost"
                confirmMessage={`Blokir ${r.person.fullName}? Pertemanan akan dihapus dan Anda tidak saling melihat konten.`}
              />
            </PersonLine>
          ))}
        </Section>
        <Section title="Diblokir" count={lists.blocked.length} empty="Tidak ada pengguna diblokir.">
          {lists.blocked.map((p) => (
            <PersonLine key={p.id} person={p}>
              <ActionButton action={unblockAccount} fields={{ accountId: p.id }} label="Buka blokir" />
            </PersonLine>
          ))}
        </Section>
      </div>
    </div>
  );
}
