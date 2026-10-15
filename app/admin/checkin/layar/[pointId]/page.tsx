import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/guard";
import { requireModule } from "@/lib/modules";
import { getCurrentTenant } from "@/lib/data/tenant";
import { getCheckinPointName } from "@/lib/data/checkin";
import { QrScreen } from "@/components/checkin/qr-screen";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

export default async function CheckinScreenPage({ params }: { params: Promise<{ pointId: string }> }) {
  const { pointId } = await params;
  await requireRole("admin");
  await requireModule("checkin");
  const [name, tenant] = await Promise.all([getCheckinPointName(pointId), getCurrentTenant()]);
  if (!name) notFound();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <Link href="/admin/checkin" className={buttonVariants({ variant: "outline", size: "sm", className: "absolute left-4 top-4" })}>
        Tutup layar
      </Link>
      <QrScreen pointId={pointId} pointName={name} clubName={tenant?.name ?? APP_NAME} />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
