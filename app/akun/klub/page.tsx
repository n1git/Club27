import { requireValidSession } from "@/lib/auth/guard";
import { getMyJoinRequests } from "@/lib/data/club-join";
import { cancelClubJoin } from "@/lib/actions/club-join";
import { formatJakartaDate, getJakartaDateString } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";
import { JoinForm } from "@/components/club-join/join-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const STATUS = {
  pending: { label: "Menunggu", variant: "secondary" },
  approved: { label: "Disetujui", variant: "success" },
  rejected: { label: "Ditolak", variant: "secondary" },
  cancelled: { label: "Dibatalkan", variant: "secondary" },
} as const;

export default async function JoinClubPage() {
  const { profile } = await requireValidSession();
  const requests = await getMyJoinRequests(profile.accountId);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Gabung klub" subtitle="Minta kode klub ke admin klub, lalu kirim permintaan. Anak-anak didaftarkan oleh klub." />
      <Card>
        <CardContent className="pt-5">
          <JoinForm fullName={profile.fullName} today={getJakartaDateString()} />
        </CardContent>
      </Card>
      {requests.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Permintaan Anda</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex flex-col">
                    <span className="font-medium">{r.clubName}</span>
                    <span className="text-xs text-muted-foreground">{formatJakartaDate(r.createdAt)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={STATUS[r.status].variant}>{STATUS[r.status].label}</Badge>
                    {r.status === "pending" ? <ActionButton action={cancelClubJoin} fields={{ requestId: r.id }} label="Batalkan" /> : null}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
