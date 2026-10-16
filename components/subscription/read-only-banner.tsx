import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { getGraceEndsOn } from "@/lib/data/platform-pricing";
import { formatJakartaDate } from "@/lib/format";

export async function ReadOnlyBanner({ canRenew }: { canRenew: boolean }) {
  const session = await getSession();
  const endsOn = session?.tenant_id ? await getGraceEndsOn(session.tenant_id) : null;
  return (
    <Alert variant="warning" className="mb-4">
      <AlertTitle>Langganan berakhir, data hanya bisa dibaca</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          Anda masih bisa melihat semua data, tetapi perubahan ditolak sampai langganan organisasi diperpanjang.
          {endsOn
            ? ` Data disimpan sampai ${formatJakartaDate(endsOn, { day: "numeric", month: "long", year: "numeric" })}.`
            : ""}
          {canRenew ? "" : " Hubungi pemilik klub untuk memperpanjang."}
        </span>
        {canRenew ? (
          <Link href="/admin/klub/langganan" className={buttonVariants({ size: "sm", className: "w-fit" })}>
            Perpanjang langganan
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
