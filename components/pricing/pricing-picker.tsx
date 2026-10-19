"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { computeQuote, formatRupiah, PERIOD_LABEL, type BillingPeriod, type PlanCode, type PricingPlan } from "@/lib/pricing";
import type { PlatformModule } from "@/lib/data/platform-pricing";
import { PlanFootnotes, PlanLines } from "./plan-terms";

export function PeriodToggle({
  period,
  onChange,
  freeMonths,
}: {
  period: BillingPeriod;
  onChange: (period: BillingPeriod) => void;
  freeMonths: number;
}) {
  const yearly = period === "yearly";
  const option = (value: BillingPeriod) =>
    cn(
      "min-h-11 cursor-pointer px-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md",
      period === value ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"
    );
  return (
    <div role="group" aria-label="Periode langganan" className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" className={option("monthly")} aria-pressed={!yearly} onClick={() => onChange("monthly")}>
        {PERIOD_LABEL.monthly}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={yearly}
        aria-label="Bayar tahunan"
        onClick={() => onChange(yearly ? "monthly" : "yearly")}
        className="relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full bg-primary p-1 shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span
          className={cn(
            "block h-6 w-8 rounded-full bg-white shadow-md transition-transform duration-200 motion-reduce:transition-none",
            yearly ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      <button type="button" className={option("yearly")} aria-pressed={yearly} onClick={() => onChange("yearly")}>
        {PERIOD_LABEL.yearly}
      </button>
      {freeMonths > 0 ? (
        <Badge variant="secondary" className="whitespace-nowrap">
          gratis {freeMonths.toLocaleString("id-ID")} bulan
        </Badge>
      ) : null}
    </div>
  );
}

const clampUsers = (value: number, min = 1) => Math.min(Math.max(Math.floor(value) || min, min), 1000);

export function UsersStepper({ id, users, onChange, min = 1 }: { id: string; users: number; onChange: (users: number) => void; min?: number }) {
  const step = "h-11 w-11 shrink-0 sm:h-9 sm:w-9";
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Jumlah seat</Label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={step}
          aria-label="Kurangi pengguna"
          disabled={users <= min}
          onClick={() => onChange(clampUsers(users - 1, min))}
        >
          <Minus className="size-4" aria-hidden />
        </Button>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={1000}
          value={users}
          onChange={(e) => onChange(clampUsers(Number(e.target.value), min))}
          className="h-11 w-16 text-center tabular-nums sm:h-9"
          aria-describedby={`${id}-hint`}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={step}
          aria-label="Tambah pengguna"
          disabled={users >= 1000}
          onClick={() => onChange(clampUsers(users + 1, min))}
        >
          <Plus className="size-4" aria-hidden />
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        Pemilik, admin, resepsionis, dan keuangan. Pelatih, kasir, dan anggota tidak memakai seat.{min > 1 ? ` Minimal ${min} seat.` : ""}
      </p>
    </div>
  );
}

export function PlanCard({
  plan,
  period,
  users,
  selected,
  onSelect,
  onUsersChange,
  action,
}: {
  plan: PricingPlan;
  period: BillingPeriod;
  users: number;
  selected?: boolean;
  onSelect?: (code: PlanCode) => void;
  onUsersChange?: (users: number) => void;
  action?: React.ReactNode;
}) {
  const quote = computeQuote(plan, period, users);
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border p-6",
        selected ? "border-primary bg-secondary" : "border-border bg-card"
      )}
    >
      <h3 className="font-heading text-lg font-semibold text-foreground">{plan.name}</h3>
      <PlanLines plan={plan} className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-foreground" />
      {onUsersChange ? (
        <div className="mt-4">
          <UsersStepper id={`${plan.code}-users`} users={users} min={plan.minSeats} onChange={onUsersChange} />
        </div>
      ) : null}
      <p className="mt-2 text-sm text-foreground" aria-live="polite">
        {quote.users} pengguna × {quote.months.toLocaleString("id-ID")} bulan ={" "}
        <span className="font-semibold">{formatRupiah(quote.total)}</span>
        {period === "yearly" ? "/tahun" : "/bulan"}
      </p>
      {period === "yearly" ? (
        <p className="text-sm text-muted-foreground">Setara {formatRupiah(quote.perMonth)}/bulan</p>
      ) : null}
      <PlanFootnotes plan={plan} className="mt-4 flex flex-col gap-0.5 text-xs text-muted-foreground" />
      <div className="mt-auto pt-6">
        {onSelect ? (
          <Button
            type="button"
            className="w-full"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            onClick={() => onSelect(plan.code)}
          >
            {selected ? "Dipilih" : `Pilih ${plan.name}`}
          </Button>
        ) : (
          action
        )}
      </div>
    </div>
  );
}

export function ModuleList({ modules }: { modules: PlatformModule[] }) {
  if (modules.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Modul yang termasuk">
      {modules.map((module) => (
        <li key={module.code}>
          <Badge variant={module.status === "ready" ? "secondary" : "outline"}>
            {module.name}
            {module.status === "soon" ? " · Segera hadir" : ""}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
