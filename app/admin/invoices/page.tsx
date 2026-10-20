import { Pagination } from "@/components/shared/pagination";
import { pageRange } from "@/lib/pagination";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { currentPermissions } from "@/lib/auth/guard";
import { markInvoicePaid, voidInvoice } from "@/lib/actions/billing";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ListFilters } from "@/components/shared/list-filters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateInvoicesForm } from "@/components/billing/generate-invoices-form";
import { ActionForm } from "@/components/shared/action-form";
import { PageHeader } from "@/components/ui/page-header";
import { FramedCard } from "@/components/ui/framed-card";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive"> =
  {
    paid: "success",
    outstanding: "secondary",
    void: "destructive",
  };

const STATUS_LABEL: Record<string, string> = {
  paid: "Lunas",
  outstanding: "Belum Bayar",
  void: "Dibatalkan",
};

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status, q, page: pageParam } = await searchParams;
  const { page, from, to } = pageRange(pageParam);
  const [supabase, session] = await Promise.all([
    createServerSupabaseClient(),
    currentPermissions(),
  ]);
  const canManage = session.has("invoices.manage");
  let query = supabase
    .from("invoices")
    .select(
      "id, amount, status, due_date, period_start, period_end, member_names!inner(full_name)",
      { count: "exact" },
    )
    .order("due_date", { ascending: false })
    .order("id");
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("member_names.full_name", `%${q}%`);
  const { data: invoices, count } = await query.range(from, to);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Tagihan</>} />
      <h2 className="text-sm font-semibold text-muted-foreground">
        Daftar Tagihan
      </h2>
      <FramedCard
        tools={
          <ListFilters
            fields={[
              {
                type: "search",
                name: "q",
                placeholder: "Cari nama anggota...",
              },
              {
                type: "select",
                name: "status",
                placeholder: "Semua Status",
                options: [
                  { value: "outstanding", label: "Belum Bayar" },
                  { value: "paid", label: "Lunas" },
                  { value: "void", label: "Dibatalkan" },
                ],
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
              <TableHead>Periode</TableHead>
              <TableHead>Jatuh Tempo</TableHead>
              <TableHead>Jumlah</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invoices ?? []).map((inv) => {
              const row = inv as unknown as {
                id: string;
                amount: number;
                status: string;
                due_date: string;
                period_start: string;
                period_end: string;
                member_names: { full_name: string } | null;
              };
              return (
                <TableRow key={row.id}>
                  <TableCell>{row.member_names?.full_name ?? "-"}</TableCell>
                  <TableCell>
                    {row.period_start} – {row.period_end}
                  </TableCell>
                  <TableCell>{row.due_date}</TableCell>
                  <TableCell>
                    Rp {Number(row.amount).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.status === "outstanding" ? (
                      <div className="flex gap-2">
                        <ActionForm action={markInvoicePaid}>
                          <input
                            type="hidden"
                            name="invoiceId"
                            value={row.id}
                          />
                          <ActionSubmitButton size="sm">
                            Tandai Lunas
                          </ActionSubmitButton>
                        </ActionForm>
                        {canManage ? (
                          <ActionForm action={voidInvoice}>
                            <input
                              type="hidden"
                              name="invoiceId"
                              value={row.id}
                            />
                            <ActionSubmitButton
                              size="sm"
                              variant="ghost"
                              confirmMessage="Batalkan tagihan ini? Tindakan ini tidak bisa dibatalkan."
                            >
                              Batalkan Tagihan
                            </ActionSubmitButton>
                          </ActionForm>
                        ) : null}
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
            {(invoices ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada tagihan.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </FramedCard>
      <Pagination
        page={page}
        total={count ?? 0}
        pathname="/admin/invoices"
        params={{ status, q }}
      />

      {canManage ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Buat Tagihan Periode Berjalan</CardTitle>
          </CardHeader>
          <CardContent>
            <GenerateInvoicesForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
