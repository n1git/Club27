"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import type { BillingPeriod, PricingPlan } from "@/lib/pricing";
import type { PlatformModule } from "@/lib/data/platform-pricing";
import { ModuleList, PeriodToggle, PlanCard } from "./pricing-picker";

export function LandingPricing({ plans, modules }: { plans: PricingPlan[]; modules: PlatformModule[] }) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [users, setUsers] = useState(3);

  if (plans.length === 0) {
    return <p className="text-sm text-muted-foreground">Harga akan segera ditampilkan.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PeriodToggle period={period} onChange={setPeriod} freeMonths={Math.max(...plans.map((p) => p.yearlyFreeMonths))} />
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            period={period}
            users={users}
            onUsersChange={setUsers}
            action={
              <Link
                href={`/daftar?plan=${plan.code}&period=${period}&users=${users}`}
                className={buttonVariants({ variant: plan.trialDays > 0 ? "default" : "outline", className: "w-full" })}
              >
                {plan.trialDays > 0 ? "Mulai Trial Gratis" : `Pilih ${plan.name}`}
              </Link>
            }
          />
        ))}
      </div>
      <ModuleList modules={modules} />
    </div>
  );
}
