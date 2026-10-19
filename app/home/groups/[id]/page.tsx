import { notFound } from "next/navigation";
import { requireValidSession } from "@/lib/auth/guard";
import { isSocialBanned } from "@/lib/auth/social-access";
import { getFriendLists } from "@/lib/data/social";
import { getGroupDetail } from "@/lib/data/groups";
import { getReadyClubTypes } from "@/lib/club-type";
import { getGroupBoard, parseBoardParams } from "@/lib/data/leaderboards";
import { Leaderboard } from "@/components/social/leaderboard";
import Link from "next/link";
import { cancelEvent, deleteGroup, leaveGroup, removeGroupMember, respondGroupInvite, rsvpEvent } from "@/lib/actions/groups";
import { formatJakartaDateTime } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";
import { EventForm, InviteForm } from "@/components/groups/group-forms";
import { ReportDialog } from "@/components/social/report-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; metrik?: string; periode?: string; olahraga?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { profile } = await requireValidSession();
  if (await isSocialBanned(profile.accountId)) notFound();
  const lists = await getFriendLists(profile.accountId);
  const detail = await getGroupDetail(profile.accountId, id, lists.friends.map((f) => f.person));
  if (!detail) notFound();
  const { group, members, events, invitable } = detail;

  if (group.status === "invited") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={group.name} subtitle={`Undangan dari ${group.owner?.fullName ?? "pengguna"}`} />
        {group.description ? <p className="text-sm">{group.description}</p> : null}
        <div className="flex gap-2">
          <ActionButton action={respondGroupInvite} fields={{ groupId: group.id, accept: "1" }} label="Terima undangan" variant="default" />
          <ActionButton action={respondGroupInvite} fields={{ groupId: group.id, accept: "0" }} label="Tolak" />
        </div>
      </div>
    );
  }

  if (query.tab === "peringkat") {
    const board = parseBoardParams(query);
    const [rows, clubTypes] = await Promise.all([getGroupBoard(group.id, board), getReadyClubTypes()]);
    const sports = clubTypes.map((t) => ({ code: t.code, label: t.name.replace(/^Klub\s+/, "") }));
    const hrefFor = (patch: { metrik?: string; periode?: string; olahraga?: string | null }) => {
      const next = new URLSearchParams({ tab: "peringkat" });
      const metrik = patch.metrik ?? query.metrik;
      const periode = patch.periode ?? query.periode;
      const olahraga = patch.olahraga === undefined ? query.olahraga : patch.olahraga;
      if (metrik) next.set("metrik", metrik);
      if (periode) next.set("periode", periode);
      if (olahraga) next.set("olahraga", olahraga);
      return `/home/groups/${group.id}?${next.toString()}`;
    };
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={group.name} subtitle="Peringkat anggota grup" />
        <GroupTabs groupId={group.id} active="peringkat" />
        <Leaderboard rows={rows} params={board} sports={sports} hrefFor={hrefFor} />
        <p className="text-xs text-muted-foreground">Hanya total per anggota yang tampil, bukan catatan latihannya. Anggota yang memblokir atau diblokir olehmu tidak ikut tampil.</p>
      </div>
    );
  }

  const upcoming = events.filter((e) => !e.cancelled && !e.finished);
  const past = events.filter((e) => e.cancelled || e.finished).slice(-5);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={group.name} subtitle={group.description ?? undefined} />
      <GroupTabs groupId={group.id} active="ringkasan" />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Event mendatang ({upcoming.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada event.</p> : null}
            {upcoming.map((e) => (
              <div key={e.id} className="flex flex-col gap-2 border-b border-dashed border-border pb-4 text-sm last:border-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-medium">{e.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatJakartaDateTime(e.startsAt)}
                      {e.location ? ` · ${e.location}` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {e.going} ikut{e.capacity ? ` dari ${e.capacity}` : ""}, {e.maybe} mungkin
                  </span>
                </div>
                {e.description ? <p className="whitespace-pre-wrap break-words">{e.description}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  {(["going", "maybe", "declined"] as const).map((status) => (
                    <ActionButton
                      key={status}
                      action={rsvpEvent}
                      fields={{ eventId: e.id, status }}
                      label={{ going: "Ikut", maybe: "Mungkin", declined: "Tidak" }[status]}
                      variant={e.mine === status ? "default" : "outline"}
                    />
                  ))}
                  {e.createdBy === profile.accountId || group.isOwner ? (
                    <ActionButton action={cancelEvent} fields={{ eventId: e.id }} label="Batalkan event" variant="ghost" confirmMessage="Batalkan event ini?" />
                  ) : null}
                  <ReportDialog targetType="event" targetId={e.id} />
                </div>
              </div>
            ))}
            {past.length ? (
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {past.map((e) => (
                  <li key={e.id}>
                    {e.title} · {formatJakartaDateTime(e.startsAt)}
                    {e.cancelled ? " · dibatalkan" : " · selesai"}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Buat event</CardTitle>
          </CardHeader>
          <CardContent>
            <EventForm groupId={group.id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Anggota ({members.filter((m) => m.status === "active").length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2 text-sm">
              {members.map((m) => (
                <li key={m.accountId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {m.person?.fullName ?? "Pengguna"}
                    {m.person ? <span className="text-xs text-muted-foreground"> @{m.person.username}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    {m.role === "owner" ? <Badge variant="secondary">Pemilik</Badge> : null}
                    {m.status === "invited" ? <Badge variant="secondary">Diundang</Badge> : null}
                    {group.isOwner && m.role !== "owner" ? (
                      <ActionButton
                        action={removeGroupMember}
                        fields={{ groupId: group.id, accountId: m.accountId }}
                        label="Keluarkan"
                        variant="ghost"
                        confirmMessage="Keluarkan anggota ini?"
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {group.isOwner ? <InviteForm groupId={group.id} friends={invitable} /> : null}
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {group.isOwner ? (
          <ActionButton
            action={deleteGroup}
            fields={{ groupId: group.id }}
            label="Hapus grup"
            variant="destructive"
            confirmMessage="Hapus grup beserta semua event? Tindakan ini tidak bisa dibatalkan."
          />
        ) : (
          <>
            <ActionButton action={leaveGroup} fields={{ groupId: group.id }} label="Keluar dari grup" confirmMessage="Keluar dari grup ini?" />
            <ReportDialog targetType="group" targetId={group.id} />
          </>
        )}
      </div>
    </div>
  );
}

function GroupTabs({ groupId, active }: { groupId: string; active: "ringkasan" | "peringkat" }) {
  const tab = (key: "ringkasan" | "peringkat", label: string, href: string) => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active === key ? "bg-foreground text-background" : "bg-secondary text-foreground hover:bg-accent"}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Bagian grup" className="flex gap-2">
      {tab("ringkasan", "Ringkasan", `/home/groups/${groupId}`)}
      {tab("peringkat", "Peringkat", `/home/groups/${groupId}?tab=peringkat`)}
    </nav>
  );
}
