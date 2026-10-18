import { requireSuperadmin } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { formatJakartaDate, getJakartaDateString } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL, type PricingPlan } from "@/lib/pricing";
import { PLAN_COLUMNS, toPlan } from "@/lib/data/platform-pricing";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/validations/superadmin";
import { MetricCard } from "@/components/ui/metric-card";
import { OrganizationControls, type OwnerRow } from "@/components/superadmin/organization-controls";
import { PlanEditor } from "@/components/superadmin/plan-editor";
import { RenewalConfirmForm } from "@/components/superadmin/renewal-confirm-form";
import { listPendingRenewals } from "@/lib/billing/renewals";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

const STATUS_VARIANT: Record<PlatformSubscriptionStatus, "success" | "secondary" | "destructive" | "warning"> = {
  pending_verification: "secondary",
  pending: "secondary",
  trial: "warning",
  active: "success",
  expired: "destructive",
  suspended: "destructive",
  cancelled: "secondary",
};

interface UsageRow {
  organization_id: string;
  name: string;
  plan_code: string | null;
  billing_period: "monthly" | "yearly" | null;
  status: PlatformSubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  club_limit_override: number | null;
  club_limit: number | null;
  clubs: number;
  members: number;
  seats_used: number;
  seats: number | null;
  total: number | string | null;
  per_month: number | string | null;
}

function formatDate(value: string) {
  return formatJakartaDate(value, { day: "numeric", month: "short", year: "numeric" });
}

export default async function SuperadminDashboardPage() {
  await requireSuperadmin();
  const supabase = createAdminSupabaseClient();
  const today = getJakartaDateString();

  const [{ data: usage }, { data: tenants }, { data: owners }, { data: planRows }, { data: organizations }, renewals] = await Promise.all([
    supabase.from("platform_organization_usage").select("*"),
    supabase.from("clubs").select("id, name, is_active, created_at, organization_id").order("created_at"),
    supabase.from("organization_users").select("id, organization_id, email, full_name, is_active"),
    supabase.from("subscription_plans").select(`${PLAN_COLUMNS}, is_active`).order("price_per_seat_month"),
    supabase.from("organizations").select("id, created_at").order("created_at", { ascending: false }),
    listPendingRenewals(),
  ]);

  const rows = (usage ?? []) as UsageRow[];
  const usageById = new Map(rows.map((r) => [r.organization_id, r]));
  const plans = (planRows ?? []) as unknown as (Parameters<typeof toPlan>[0] & { is_active: boolean })[];
  const isTrialExpired = (r: UsageRow) => r.status === "trial" && !!r.trial_ends_at && r.trial_ends_at < today;
  const isOverdue = (r: UsageRow) => r.status === "active" && !!r.current_period_end && r.current_period_end < today;
  const monthlyRevenue = rows.filter((r) => r.status === "active").reduce((sum, r) => sum + Number(r.per_month ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Dasbor Platform</>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard title="Organisasi / klub" value={`${rows.length} / ${(tenants ?? []).length}`} />
        <MetricCard title="Menunggu aktivasi" value={String(rows.filter((r) => r.status === "pending").length)} />
        <MetricCard title="Trial berjalan" value={String(rows.filter((r) => r.status === "trial" && !isTrialExpired(r)).length)} />
        <MetricCard title="Berakhir" value={String(rows.filter((r) => r.status === "expired" || isTrialExpired(r)).length)} />
        <MetricCard
          title={`Pendapatan bulanan (${rows.filter((r) => r.status === "active").length} aktif)`}
          value={formatRupiah(monthlyRevenue)}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Perpanjangan menunggu pembayaran</h2>
        {renewals.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisasi</TableHead>
                <TableHead>Paket</TableHead>
                <TableHead>Pengguna</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Diajukan</TableHead>
                <TableHead>Konfirmasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {renewals.map((renewal) => (
                <TableRow key={renewal.id}>
                  <TableCell className="font-medium">{renewal.organizationName ?? "-"}</TableCell>
                  <TableCell>
                    {renewal.planName ?? renewal.planCode} · {PERIOD_LABEL[renewal.billingPeriod]}
                  </TableCell>
                  <TableCell>{renewal.users}</TableCell>
                  <TableCell>{formatRupiah(renewal.amount)}</TableCell>
                  <TableCell>{formatDate(renewal.requestedAt)}</TableCell>
                  <TableCell>
                    <RenewalConfirmForm renewalId={renewal.id} amount={formatRupiah(renewal.amount)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Tidak ada pengajuan yang menunggu.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Paket</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Harga, batas klub, hari trial, dan bulan gratis tahunan hanya disimpan di sini. Perubahan berlaku untuk
          perhitungan berikutnya.
        </p>
        <div className="grid gap-3">
          {plans.map((plan) => (
            <PlanEditor key={plan.code} plan={toPlan(plan) as PricingPlan} isActive={plan.is_active} />
          ))}
        </div>
      </section>

      <p className="max-w-3xl text-sm text-muted-foreground">
        Ubah status ke Aktif setelah pembayaran organisasi diterima. Ditangguhkan dan Dibatalkan langsung memutus akses
        seluruh klub organisasi; datanya tetap tersimpan. Pemilik yang dinonaktifkan kehilangan akses ke semua klubnya
        sekaligus. Periode atau trial yang lewat otomatis menjadi Berakhir setiap pagi: pemilik hanya bisa membuka
        halaman Langganan sampai perpanjangannya dikonfirmasi di atas.
      </p>

      {(organizations ?? []).map((organization) => {
        const row = usageById.get(organization.id as string);
        if (!row) return null;
        const orgTenants = (tenants ?? []).filter((t) => t.organization_id === organization.id);
        const orgOwners = (owners ?? []).filter((o) => o.organization_id === organization.id) as unknown as OwnerRow[];
        const status = row.status;
        return (
          <section key={row.organization_id} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{row.name}</h2>
              {status ? <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge> : <Badge variant="outline">Tanpa langganan</Badge>}
              {isTrialExpired(row) ? <Badge variant="destructive">Trial berakhir</Badge> : null}
              {isOverdue(row) ? <Badge variant="destructive">Lewat jatuh tempo</Badge> : null}
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Paket</div>
                {row.plan_code ? `${row.plan_code === "advanced" ? "Advanced" : "Standard"} · ${PERIOD_LABEL[row.billing_period ?? "monthly"]}` : "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Seat terpakai</div>
                {row.seats_used} / {row.seats ?? "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Klub / batas · Anggota</div>
                {row.clubs} / {row.club_limit ?? "∞"} · {row.members}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total · per bulan</div>
                {row.total !== null ? `${formatRupiah(Number(row.total))} · ${formatRupiah(Number(row.per_month))}` : "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Akhir periode</div>
                {row.current_period_end ? formatDate(row.current_period_end) : "Belum diatur"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Trial berakhir</div>
                {row.trial_ends_at ? formatDate(row.trial_ends_at) : "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Terdaftar</div>
                {formatDate(organization.created_at as string)}
              </div>
            </div>
            <OrganizationControls
              organizationId={row.organization_id}
              status={status}
              trialEndsAt={row.trial_ends_at}
              clubLimitOverride={row.club_limit_override}
              today={today}
              owners={orgOwners}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Klub</TableHead>
                  <TableHead>Akses</TableHead>
                  <TableHead>Terdaftar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell>
                      <Badge variant={tenant.is_active ? "success" : "destructive"}>{tenant.is_active ? "Aktif" : "Diputus"}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(tenant.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        );
      })}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada organisasi. Organisasi baru muncul di sini setelah mendaftar lewat halaman /signup.
        </p>
      ) : null}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
