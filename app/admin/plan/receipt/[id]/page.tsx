import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { organizationIdForTenant } from "@/lib/data/roles";
import { getRenewal } from "@/lib/billing/renewals";
import { BillingDocument } from "@/components/subscription/billing-document";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing.view");
  const { id } = await params;
  const [organizationId, renewal] = await Promise.all([organizationIdForTenant(user.tenantId), getRenewal(id)]);
  if (!organizationId || !renewal || renewal.organizationId !== organizationId || !renewal.receiptNumber) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Kwitansi</>} />
      <BillingDocument renewal={renewal} kind="receipt" />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
