import { Pagination } from "@/components/shared/pagination";
import { pageRange } from "@/lib/pagination";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guard";
import { getOrders } from "@/lib/data/commerce";
import { ORDER_STATUS_LABEL } from "@/lib/commerce";
import { formatJakartaDateTime, formatRupiahFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

const FILTERS = [
  { value: "", label: "Semua" },
  { value: "open", label: "Belum lunas" },
  { value: "paid", label: "Lunas" },
  { value: "void", label: "Dibatalkan" },
];

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const session = await requirePermission("pos.orders_view");
  const { status, page: pageParam } = await searchParams;
  const { page, from, to } = pageRange(pageParam);
  const active = FILTERS.some((f) => f.value === status) ? (status ?? "") : "";
  const { rows: orders, total } = await getOrders({ status: active || undefined, from, to });

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Pesanan</>} subtitle={<>Riwayat penjualan dan pembayarannya.</>}>
        {session.permissions.has("pos.sell") ? (
          <Link href="/admin/pos" className={buttonVariants()}>
            Buka kasir
          </Link>
        ) : null}
      </PageHeader>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter status">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/orders?status=${f.value}` : "/admin/orders"}
            aria-current={active === f.value ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium",
              active === f.value ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Belum ada pesanan{active ? " dengan status ini" : ""}.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Dibayar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.number}</TableCell>
                    <TableCell>{formatJakartaDateTime(o.createdAt)}</TableCell>
                    <TableCell>{o.memberName ?? o.customerName ?? "-"}</TableCell>
                    <TableCell className="tabular-nums">{formatRupiahFull(o.total)}</TableCell>
                    <TableCell className="tabular-nums">{formatRupiahFull(o.paid)}</TableCell>
                    <TableCell>
                      <Badge variant={o.status === "paid" ? "success" : o.status === "void" ? "destructive" : "warning"}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/orders/${o.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Lihat
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={page} total={total} pathname="/admin/orders" params={{ status: active || undefined }} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
