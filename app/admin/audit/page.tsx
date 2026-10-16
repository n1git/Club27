import Link from "next/link";
import { requirePermission } from "@/lib/auth/guard";
import { loadOwner } from "@/lib/auth/owner";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatJakartaDateTime } from "@/lib/format";
import { pageRange } from "@/lib/pagination";
import { Pagination } from "@/components/shared/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

const ACTION_LABEL: Record<string, string> = {
  "password.reset": "Atur ulang kata sandi",
  "password.change": "Ganti kata sandi",
  "staff.role": "Ubah peran staf",
  "staff.activate": "Aktifkan staf",
  "staff.deactivate": "Nonaktifkan staf",
  "member.activate": "Aktifkan anggota",
  "member.deactivate": "Nonaktifkan anggota",
  "member.anonymise": "Anonimkan anggota",
  "member_account.activate": "Aktifkan akun anggota",
  "invoice.paid": "Tagihan ditandai lunas",
  "invoice.void": "Batalkan tagihan",
  "order.void": "Batalkan pesanan",
  "subscription.plan_change": "Ubah paket langganan",
  "subscription.renewal_request": "Ajukan perpanjangan langganan",
  "subscription.renewal_confirm": "Konfirmasi pembayaran langganan",
  "organization.status": "Ubah status langganan",
  "organization.trial": "Ubah masa trial",
  "organization.club_limit": "Ubah batas klub",
  "owner.activate": "Aktifkan pemilik",
  "owner.deactivate": "Nonaktifkan pemilik",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  coach: "Pelatih",
  receptionist: "Resepsionis",
  finance: "Keuangan",
  member: "Anggota",
  superadmin: "Admin platform",
};

function formatDetails(details: Record<string, unknown>) {
  return Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(", ");
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string; scope?: string }> }) {
  const user = await requirePermission("audit.view");
  const params = await searchParams;
  const owner = await loadOwner(user.id, user.tenantId);
  const orgScope = Boolean(owner) && params.scope === "org";
  const { page, from, to } = pageRange(params.page);

  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("audit_log")
    .select("id, at, actor_id, actor_role, actor_label, tenant_id, action, target_type, details, tenants(name)", { count: "exact" })
    .order("at", { ascending: false })
    .order("id")
    .range(from, to);
  if (!orgScope) query = query.eq("tenant_id", user.tenantId);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as {
    id: string;
    at: string;
    actor_id: string | null;
    actor_role: string | null;
    actor_label: string | null;
    action: string;
    target_type: string | null;
    details: Record<string, unknown>;
    tenants: { name: string } | null;
  }[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const tabClass = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium sm:min-h-9",
      active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Log Audit</>} subtitle={<>Tindakan penting di klub, siapa yang melakukan, dan kapan. Catatan tidak bisa diubah atau dihapus.</>} />
      {owner ? (
        <div className="flex gap-2" role="group" aria-label="Cakupan log">
          <Link href="/admin/audit" className={tabClass(!orgScope)} aria-current={!orgScope ? "page" : undefined}>
            Klub ini
          </Link>
          <Link href="/admin/audit?scope=org" className={tabClass(orgScope)} aria-current={orgScope ? "page" : undefined}>
            Semua klub organisasi
          </Link>
        </div>
      ) : null}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel log audit">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Waktu (WIB)</TableHead>
              <TableHead>Pelaku</TableHead>
              <TableHead>Tindakan</TableHead>
              {orgScope ? <TableHead>Klub</TableHead> : null}
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatJakartaDateTime(r.at)}</TableCell>
                <TableCell>
                  {r.actor_label ?? (r.actor_id ? (actorName.get(r.actor_id) ?? "Pengguna") : "Sistem")}
                  {r.actor_role ? <span className="block text-xs text-muted-foreground">{ROLE_LABEL[r.actor_role] ?? r.actor_role}</span> : null}
                </TableCell>
                <TableCell>{ACTION_LABEL[r.action] ?? r.action}</TableCell>
                {orgScope ? <TableCell>{r.tenants?.name ?? "Organisasi"}</TableCell> : null}
                <TableCell className="max-w-xs break-words text-sm text-muted-foreground">{formatDetails(r.details) || "-"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={orgScope ? 5 : 4} className="text-center text-muted-foreground">
                  Belum ada catatan.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} total={count ?? 0} pathname="/admin/audit" params={{ scope: orgScope ? "org" : undefined }} />
    </div>
  );
}
