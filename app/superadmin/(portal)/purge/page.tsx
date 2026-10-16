import { requireSuperadmin } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatJakartaDate } from "@/lib/format";
import { PurgeSimulator } from "@/components/superadmin/purge-simulator";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const REASON: Record<string, string> = { owner_deleted: "Dihapus pemilik", grace_expired: "Masa tenggang habis" };

export default async function PurgePage() {
  await requireSuperadmin();
  const supabase = createAdminSupabaseClient();
  const [{ data: candidates }, { data: flag }, { data: history }] = await Promise.all([
    supabase.rpc("purge_candidates"),
    supabase.from("platform_flags").select("enabled").eq("key", "purge_enabled").maybeSingle(),
    supabase.from("organization_purges").select("id, organization_name, reason, purged_at").order("purged_at", { ascending: false }).limit(20),
  ]);
  const rows = (candidates ?? []) as { organization_id: string; name: string; reason: string; since: string; eligible_at: string }[];
  const date = (value: string) => formatJakartaDate(value, { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <PageHeader title={<>Purge data</>} />
        <Badge variant={flag?.enabled ? "destructive" : "secondary"}>{flag?.enabled ? "Purge aktif" : "Purge mati"}</Badge>
      </div>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Daftar organisasi yang memenuhi syarat penghapusan permanen. Tidak ada penghapusan otomatis; halaman ini hanya menghitung apa yang akan
        terhapus.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organisasi</TableHead>
            <TableHead>Alasan</TableHead>
            <TableHead>Sejak</TableHead>
            <TableHead>Layak purge</TableHead>
            <TableHead>Simulasi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.organization_id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{REASON[row.reason] ?? row.reason}</TableCell>
              <TableCell>{date(row.since)}</TableCell>
              <TableCell>{date(row.eligible_at)}</TableCell>
              <TableCell>
                <PurgeSimulator organizationId={row.organization_id} />
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada organisasi yang layak di-purge.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
      {(history ?? []).length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Riwayat purge</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisasi</TableHead>
                <TableHead>Alasan</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history ?? []).map((h) => (
                <TableRow key={h.id as string}>
                  <TableCell>{h.organization_name}</TableCell>
                  <TableCell>{REASON[h.reason as string] ?? h.reason}</TableCell>
                  <TableCell>{date(h.purged_at as string)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </div>
  );
}
