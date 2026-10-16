import { requirePermission } from "@/lib/auth/guard";
import { getProducts, getUnpaidBookings } from "@/lib/data/commerce";
import { isModuleReady } from "@/lib/modules";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { PageHeader } from "@/components/ui/page-header";

export default async function CashierPage() {
  await requirePermission("pos.sell");
  const bookingOn = await isModuleReady("resource_booking");
  const [products, bookings] = await Promise.all([
    getProducts({ activeOnly: true }),
    bookingOn ? getUnpaidBookings() : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4 pb-16 lg:pb-0">
      <PageHeader title={<>Kasir</>} subtitle={<>Pilih item, catat pembayaran, lalu cetak struk.</>} />
      <PosTerminal products={products} bookings={bookings} />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
