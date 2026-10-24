import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth/superadmin";
import { getRenewal } from "@/lib/billing/renewals";
import { BillingDocument } from "@/components/subscription/billing-document";

export default async function SuperadminBillingDocumentPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requireSuperadmin();
  const { kind, id } = await params;
  if (kind !== "invoice" && kind !== "receipt") notFound();
  const renewal = await getRenewal(id);
  if (!renewal || !(kind === "invoice" ? renewal.invoiceNumber : renewal.receiptNumber)) notFound();
  return <BillingDocument renewal={renewal} kind={kind} />;
}

export const unstable_dynamicStaleTime = 0;
