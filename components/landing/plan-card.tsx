"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { PeriodToggle, UsersStepper } from "@/components/pricing/pricing-picker";
import { PlanFootnotes, PlanLines } from "@/components/pricing/plan-terms";
import { computeQuote, formatRupiah, type BillingPeriod, type PricingPlan } from "@/lib/pricing";
import { ctaClass } from "./cta";

export function PlanCard({ plan }: { plan: PricingPlan }) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [seats, setSeats] = useState(plan.minSeats);
  const quote = computeQuote(plan, period, seats);

  return (
    <article className="flex flex-col gap-5 rounded-[28px] bg-primary p-7 text-primary-foreground sm:p-9">
      <h3 className="font-display text-[44px] leading-none">{plan.name}</h3>
      <PlanLines plan={plan} className="flex flex-col gap-2 text-lg font-semibold [&>li]:flex [&>li]:items-start [&>li]:gap-2.5 [&>li]:before:mt-1.5 [&>li]:before:size-2 [&>li]:before:shrink-0 [&>li]:before:rounded-full [&>li]:before:bg-primary-foreground [&>li]:before:content-['']" />
      <div className="flex flex-col gap-4 rounded-2xl bg-background p-5 text-foreground">
        <PeriodToggle period={period} onChange={setPeriod} freeMonths={plan.yearlyFreeMonths} />
        <UsersStepper id="landing-seats" users={seats} min={plan.minSeats} onChange={setSeats} />
        <p aria-live="polite" className="flex items-start gap-2 text-sm">
          <Check className="mt-0.5 size-4 shrink-0 text-accent-foreground" aria-hidden />
          <span>
            {quote.users} seat × {quote.months.toLocaleString("id-ID")} bulan ={" "}
            <b className="text-base">{formatRupiah(quote.total)}</b>
            {period === "yearly" ? ` per tahun (setara ${formatRupiah(quote.perMonth)} per bulan)` : " per bulan"}
          </span>
        </p>
      </div>
      <PlanFootnotes plan={plan} className="flex flex-col gap-1 text-sm text-primary-foreground/85" />
      <Link href={`/signup?plan=${plan.code}&period=${period}&users=${seats}`} className={ctaClass("ink")}>
        Daftarkan klub
      </Link>
    </article>
  );
}
