import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getOrderDetail } from "@/lib/data/commerce";
import { getCurrentTenant } from "@/lib/data/tenant";
import { BackLink } from "@/components/shared/back-link";
import { PaymentForm, PrintButton, VoidForm } from "@/components/pos/order-actions";
import { Receipt } from "@/components/pos/receipt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission("pos.orders_view");
  const { id } = await params;
  const [order, tenant] = await Promise.all([getOrderDetail(id), getCurrentTenant()]);
  if (!order) notFound();
  const canManage = session.permissions.has("pos.sell");

  return (
    <div className="flex flex-col gap-4">
      <div className="print:hidden">
        <BackLink href="/admin/pesanan" label="Pesanan" />
      </div>
      <Receipt order={order} clubName={tenant?.name ?? ""} />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          {canManage && order.status !== "void" && !(order.status === "open" && order.paid > 0) ? (
            <VoidForm orderId={order.id} paid={order.status === "paid"} />
          ) : null}
        </div>
        {canManage && order.status === "open" ? (
          <Card>
            <CardHeader>
              <CardTitle>Catat pembayaran</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentForm orderId={order.id} remaining={order.total - order.paid} />
            </CardContent>
          </Card>
        ) : null}
        {order.status === "open" && order.paid > 0 ? (
          <p className="text-xs text-muted-foreground">Pesanan dengan pembayaran sebagian tidak bisa dibatalkan. Lunasi dulu.</p>
        ) : null}
      </div>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
