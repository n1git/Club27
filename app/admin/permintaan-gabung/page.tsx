import { requireModule } from "@/lib/modules";
import { requirePermission } from "@/lib/auth/guard";
import { getPendingClubJoinRequests } from "@/lib/data/club-join";
import { getActiveCoaches } from "@/lib/data/lookups";
import { formatJakartaDate } from "@/lib/format";
import { DecideForm } from "@/components/club-join/decide-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function JoinRequestsPage() {
  await requirePermission("members.create");
  await requireModule("member_portal");
  const [{ slug, requests }, coaches] = await Promise.all([getPendingClubJoinRequests(), getActiveCoaches()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Permintaan gabung" subtitle="Calon anggota dewasa yang mendaftar sendiri dengan kode klub. Anak-anak didaftarkan manual di menu Anggota." />
      <Card>
        <CardContent className="pt-5 text-sm">
          Kode klub untuk dibagikan: <code className="rounded bg-secondary px-2 py-0.5 font-mono">{slug}</code>
        </CardContent>
      </Card>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada permintaan yang menunggu.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.fullName}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Lahir {formatJakartaDate(`${r.dateOfBirth}T00:00:00+07:00`)}
                  {r.phone ? ` · ${r.phone}` : ""} · diajukan {formatJakartaDate(r.createdAt)}
                </p>
                {r.message ? <p className="whitespace-pre-wrap break-words">{r.message}</p> : null}
                <DecideForm request={r} coaches={coaches} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
