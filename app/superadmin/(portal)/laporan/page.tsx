import { requireSuperadmin } from "@/lib/auth/superadmin";
import { getReports } from "@/lib/data/reports";
import { reactivateAccount, resolveReport } from "@/lib/actions/reports";
import { formatJakartaDateTime } from "@/lib/format";
import { ActionButton } from "@/components/shared/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

const TYPE = { post: "Postingan", comment: "Komentar", account: "Akun", group: "Grup", event: "Event" } as const;
const STATUS = { open: "Terbuka", dismissed: "Diabaikan", removed: "Konten dihapus", suspended: "Akun dinonaktifkan" } as const;

export default async function ReportsPage() {
  await requireSuperadmin();
  const [open, resolved] = await Promise.all([getReports("open"), getReports("resolved")]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Laporan" subtitle="Laporan pengguna atas postingan, komentar, grup, event, dan akun." />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Terbuka ({open.length})</h2>
        {open.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada laporan terbuka.</p> : null}
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle>{TYPE[r.targetType]}</CardTitle>
                <span className="text-xs text-muted-foreground">{formatJakartaDateTime(r.createdAt)}</span>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="whitespace-pre-wrap break-words rounded border border-dashed border-border p-2">
                  {r.targetGone ? "Konten sudah dihapus" : r.preview}
                </p>
                <p>
                  <span className="text-muted-foreground">Alasan: </span>
                  {r.reason}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pelapor: {r.reporter}
                  {r.author ? ` · Penulis: ${r.author.label}${r.author.active ? "" : " (nonaktif)"}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  <ActionButton action={resolveReport} fields={{ reportId: r.id, action: "dismiss" }} label="Abaikan" />
                  {r.targetType !== "account" && !r.targetGone ? (
                    <ActionButton action={resolveReport} fields={{ reportId: r.id, action: "remove" }} label="Hapus konten" variant="destructive" confirmMessage="Hapus konten ini secara permanen?" />
                  ) : null}
                  {r.author?.active ? (
                    <ActionButton
                      action={resolveReport}
                      fields={{ reportId: r.id, action: "suspend" }}
                      label="Nonaktifkan akun"
                      variant="destructive"
                      confirmMessage="Nonaktifkan akun penulis? Semua sesinya berakhir dan ia tidak bisa masuk."
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Terakhir ditinjau</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {resolved.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {TYPE[r.targetType]} · {r.author?.label ?? "-"} · {r.reason.slice(0, 60)}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant="secondary">{STATUS[r.status]}</Badge>
                {r.status === "suspended" && r.author && !r.author.active ? (
                  <ActionButton action={reactivateAccount} fields={{ accountId: r.author.id }} label="Aktifkan kembali" />
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
