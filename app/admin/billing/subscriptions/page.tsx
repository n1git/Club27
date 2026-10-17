import { Pagination } from "@/components/shared/pagination";
import { pageRange } from "@/lib/pagination";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActivePackages } from "@/lib/data/lookups";
import { cancelSubscription } from "@/lib/actions/billing";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ListFilters } from "@/components/shared/list-filters";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionForm } from "@/components/billing/subscription-form";
import { ActionForm } from "@/components/shared/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { FramedCard } from "@/components/ui/framed-card";

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  paused: "Ditunda",
  cancelled: "Dibatalkan",
  expired: "Kedaluwarsa",
};

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; package?: string; page?: string }>;
}) {
  const { status, package: packageId, page: pageParam } = await searchParams;
  const { page, from, to } = pageRange(pageParam);
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("member_memberships")
    .select(
      "id, status, start_date, end_date, member_names(full_name), membership_packages(name)",
      { count: "exact" },
    )
    .order("start_date", { ascending: false })
    .order("id");
  if (status) query = query.eq("status", status);
  if (packageId) query = query.eq("package_id", packageId);
  const [{ data: subscriptions, count }, packages] = await Promise.all([
    query.range(from, to),
    getActivePackages(),
  ]);
  const { data: usageRows } = await supabase
    .from("membership_usage")
    .select("subscription_id, sessions_used, sessions_included")
    .in(
      "subscription_id",
      (subscriptions ?? []).map((s) => s.id),
    );
  const usageBySubscription = new Map(
    (usageRows ?? []).map((u) => [u.subscription_id, u]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Langganan</>} />
        <TriggerDialog
          trigger={<span className={buttonVariants({})}>Tambah Langganan</span>}
        >
          <h2 className="mb-4 text-xl font-semibold">Tambah Langganan</h2>
          <SubscriptionForm packages={packages} />
        </TriggerDialog>
      </div>
      <h2 className="text-sm font-semibold text-muted-foreground">
        Daftar Langganan
      </h2>
      <FramedCard
        tools={
          <ListFilters
            fields={[
              {
                type: "select",
                name: "status",
                placeholder: "Semua Status",
                options: [
                  { value: "active", label: "Aktif" },
                  { value: "paused", label: "Ditunda" },
                  { value: "cancelled", label: "Dibatalkan" },
                  { value: "expired", label: "Kedaluwarsa" },
                ],
              },
              {
                type: "select",
                name: "package",
                placeholder: "Semua Paket",
                options: packages.map((p) => ({ value: p.id, label: p.name })),
              },
            ]}
          />
        }
        bodyClassName="p-0 overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Anggota</TableHead>
              <TableHead>Paket</TableHead>
              <TableHead>Mulai</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sesi</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(subscriptions ?? []).map((s) => {
              const row = s as unknown as {
                id: string;
                status: string;
                start_date: string;
                member_names: { full_name: string } | null;
                membership_packages: { name: string } | null;
              };
              const usage = usageBySubscription.get(row.id);
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.member_names?.full_name ?? "-"}</TableCell>
                  <TableCell>{row.membership_packages?.name ?? "-"}</TableCell>
                  <TableCell>{row.start_date}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "active" ? "success" : "secondary"
                      }
                    >
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {usage
                      ? `${usage.sessions_used} / ${usage.sessions_included}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {row.status === "active" ? (
                      <ActionForm action={cancelSubscription}>
                        <input
                          type="hidden"
                          name="subscriptionId"
                          value={row.id}
                        />
                        <ActionSubmitButton
                          variant="ghost"
                          size="sm"
                          confirmMessage="Batalkan langganan ini? Tindakan ini tidak bisa dibatalkan."
                        >
                          Batalkan Langganan
                        </ActionSubmitButton>
                      </ActionForm>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {(subscriptions ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada langganan.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </FramedCard>
      <Pagination
        page={page}
        total={count ?? 0}
        pathname="/admin/billing/subscriptions"
        params={{ status, package: packageId }}
      />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
