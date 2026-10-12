import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/auth/session";
import { loadOwner } from "@/lib/auth/owner";
import { getOwnSubscription } from "@/lib/data/platform-pricing";
import { getJakartaDateString } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMIND_DAYS = 7;

function daysUntil(date: string) {
  return Math.round((Date.parse(date) - Date.parse(getJakartaDateString())) / DAY_MS);
}

function endsLabel(days: number) {
  return days === 0 ? "hari ini" : days === 1 ? "besok" : `dalam ${days} hari`;
}

export async function SubscriptionBanner() {
  const [subscription, session] = await Promise.all([getOwnSubscription(), getSession()]);
  if (!subscription) return null;

  const isTrial = subscription.status === "trial";
  const endDate = isTrial ? subscription.trialEndsAt : subscription.status === "active" ? subscription.currentPeriodEnd : null;
  if (!endDate) return null;
  const days = daysUntil(endDate);
  if (days < 0 || (!isTrial && days > REMIND_DAYS)) return null;

  const owner = session ? await loadOwner(session.sub, session.tenant_id) : null;
  const soon = days <= REMIND_DAYS;
  const title = isTrial ? `Masa trial berakhir ${endsLabel(days)}` : `Langganan berakhir ${endsLabel(days)}`;

  return (
    <Alert variant={soon ? "warning" : "default"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          Setelah berakhir, akses klub dikunci sampai langganan diperpanjang. Data tetap tersimpan.
          {owner ? " Ajukan perpanjangan dan selesaikan pembayaran sebelum tanggal berakhir." : " Hubungi pemilik klub untuk memperpanjang."}
        </span>
        {owner ? (
          <Link href="/admin/klub/langganan" className={buttonVariants({ size: "sm", className: "w-fit" })}>
            Perpanjang langganan
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
