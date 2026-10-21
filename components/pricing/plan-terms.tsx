import { getContact } from "@/lib/site";
import { rupiahCompact, trialLabel, type PricingPlan } from "@/lib/pricing";

function couponUrl(): string | null {
  const contact = getContact();
  return contact.whatsappUrl ?? (contact.email ? `mailto:${contact.email}` : null);
}

export function PlanLines({ plan, className }: { plan: PricingPlan; className?: string }) {
  const coupon = couponUrl() !== null;
  return (
    <ul className={className}>
      <li>
        {rupiahCompact(plan.pricePerUserMonth)} / seat / bulan, minimal {plan.minSeats} seat
      </li>
      <li>{plan.clubLimit ? `Sampai ${plan.clubLimit} klub*` : "Klub tanpa batas"}</li>
      <li>Anggota tanpa batas**</li>
      {plan.trialDays > 0 ? (
        <li>
          Trial {trialLabel(plan.trialDays)}
          {coupon ? "***" : ""}
        </li>
      ) : null}
    </ul>
  );
}

export function PlanFootnotes({ plan, className }: { plan: PricingPlan; className?: string }) {
  const url = couponUrl();
  return (
    <div className={className}>
      {plan.clubLimit ? <p>* Butuh lebih banyak klub? Hubungi admin</p> : null}
      <p>** Kebijakan pemakaian wajar 1.000 anggota per klub</p>
      {url && plan.trialDays > 0 ? (
        <p>
          *** Dapatkan kode kupon{" "}
          <a href={url} target={url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
            di sini
          </a>
        </p>
      ) : null}
    </div>
  );
}
