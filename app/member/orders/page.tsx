import { requireMemberClub } from "@/lib/auth/guard";
import { getMyOrders } from "@/lib/data/commerce";
import { formatJakartaDateTime, formatRupiahFull } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function MemberOrdersPage() {
  await requireMemberClub();
  const orders = await getMyOrders();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <PageHeader title={<>Pesanan saya</>} subtitle={<>Riwayat pembelian yang sudah lunas di klub ini.</>} />
      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Belum ada pesanan.</p>
      ) : (
        orders.map((o) => (
          <Card key={o.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">{o.number}</CardTitle>
                <p className="text-xs text-muted-foreground">{formatJakartaDateTime(o.paidAt ?? o.createdAt)}</p>
              </div>
              <span className="font-semibold tabular-nums">{formatRupiahFull(o.total)}</span>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1 text-sm">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>
                      {i.description}
                      {i.qty > 1 ? ` × ${i.qty}` : ""}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{formatRupiahFull(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
