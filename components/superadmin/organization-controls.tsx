"use client";

import {
  activateOrganization,
  setOrganizationStatus,
  extendTrial,
  setClubLimitOverride,
  toggleOwnerActive,
} from "@/lib/actions/superadmin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/platform-status";

export interface OwnerRow {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

const SETTABLE_STATUSES: PlatformSubscriptionStatus[] = ["pending", "trial", "suspended", "cancelled"];

export function OrganizationControls({
  organizationId,
  status,
  trialEndsAt,
  clubLimitOverride,
  today,
  owners,
}: {
  organizationId: string;
  status: PlatformSubscriptionStatus | null;
  trialEndsAt: string | null;
  clubLimitOverride: number | null;
  today: string;
  owners: OwnerRow[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ActionForm action={activateOrganization} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Mulai periode
          <Input name="periodStart" type="date" defaultValue={today} className="w-40" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Akhir periode (opsional)
          <Input name="periodEnd" type="date" className="w-40" />
        </label>
        <ActionSubmitButton size="sm">Aktifkan</ActionSubmitButton>
      </ActionForm>

      <ActionForm action={setOrganizationStatus} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Ubah status
          <Select name="status" defaultValue="suspended" className="w-44">
            {SETTABLE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </label>
        <ActionSubmitButton
          size="sm"
          variant="outline"
          confirmMessage="Ubah status langganan? Ditangguhkan atau Dibatalkan langsung memutus akses semua klub organisasi ini."
        >
          Terapkan
        </ActionSubmitButton>
      </ActionForm>

      {status === "trial" ? (
        <ActionForm action={extendTrial} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Trial berakhir
            <Input name="trialEndsAt" type="date" required defaultValue={trialEndsAt ?? today} className="w-40" />
          </label>
          <ActionSubmitButton size="sm" variant="outline">
            Perpanjang trial
          </ActionSubmitButton>
        </ActionForm>
      ) : null}

      <ActionForm action={setClubLimitOverride} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="organizationId" value={organizationId} />
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Batas klub khusus (kosong = ikut paket)
          <Input name="clubLimitOverride" type="number" min={1} max={1000} defaultValue={clubLimitOverride ?? ""} className="w-28" />
        </label>
        <ActionSubmitButton size="sm" variant="outline">
          Simpan
        </ActionSubmitButton>
      </ActionForm>

      <div className="flex flex-col gap-2 lg:col-span-2">
        {owners.map((owner) => (
          <ActionForm key={owner.id} action={toggleOwnerActive} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="ownerId" value={owner.id} />
            <input type="hidden" name="isActive" value={(!owner.is_active).toString()} />
            <span className="text-sm">
              {owner.full_name} — {owner.email}
            </span>
            <Badge variant={owner.is_active ? "success" : "destructive"}>{owner.is_active ? "Aktif" : "Nonaktif"}</Badge>
            <ActionSubmitButton
              size="sm"
              variant={owner.is_active ? "destructive" : "secondary"}
              confirmMessage={
                owner.is_active ? "Nonaktifkan pemilik ini? Semua klub miliknya langsung tidak bisa diakses olehnya." : undefined
              }
            >
              {owner.is_active ? "Nonaktifkan" : "Aktifkan"}
            </ActionSubmitButton>
          </ActionForm>
        ))}
      </div>
    </div>
  );
}
