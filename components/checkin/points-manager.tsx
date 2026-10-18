"use client";

import Link from "next/link";
import { createCheckinPoint, renameCheckinPoint, setCheckinPointActive } from "@/lib/actions/checkin";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { CheckinPoint } from "@/lib/data/checkin";
import type { Lookup } from "@/lib/data/lookups";

export function PointsManager({ points, locations }: { points: CheckinPoint[]; locations: Lookup[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={createCheckinPoint} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="point-name">Nama titik baru</Label>
          <Input id="point-name" name="name" required minLength={2} maxLength={60} className="w-56" placeholder="Pintu utama" />
        </div>
        {locations.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="point-location">Lokasi (opsional)</Label>
            <Select id="point-location" name="locationId" defaultValue="" className="w-48">
              <option value="">— Tidak ditentukan —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <ActionSubmitButton>Tambah titik</ActionSubmitButton>
      </ActionForm>

      <ul className="flex flex-col gap-3">
        {points.map((point) => (
          <li key={point.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
            <ActionForm action={renameCheckinPoint} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="pointId" value={point.id} />
              <Input
                name="name"
                defaultValue={point.name}
                required
                minLength={2}
                maxLength={60}
                aria-label={`Nama titik ${point.name}`}
                className="w-48"
              />
              <ActionSubmitButton size="sm" variant="outline">
                Simpan nama
              </ActionSubmitButton>
            </ActionForm>
            <Badge variant={point.isActive ? "success" : "secondary"}>{point.isActive ? "Aktif" : "Nonaktif"}</Badge>
            {point.locationName ? <span className="text-sm text-muted-foreground">{point.locationName}</span> : null}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {point.isActive ? (
                <Link
                  href={`/admin/checkin/screen/${point.id}`}
                  target="_blank"
                  className={buttonVariants({ size: "sm" })}
                >
                  Tampilkan QR
                </Link>
              ) : null}
              <ActionForm action={setCheckinPointActive}>
                <input type="hidden" name="pointId" value={point.id} />
                <input type="hidden" name="isActive" value={(!point.isActive).toString()} />
                <ActionSubmitButton
                  size="sm"
                  variant={point.isActive ? "destructive" : "secondary"}
                  confirmMessage={point.isActive ? "Nonaktifkan titik ini? QR-nya langsung tidak berlaku." : undefined}
                >
                  {point.isActive ? "Nonaktifkan" : "Aktifkan"}
                </ActionSubmitButton>
              </ActionForm>
            </div>
          </li>
        ))}
        {points.length === 0 ? <li className="text-sm text-muted-foreground">Belum ada titik check-in.</li> : null}
      </ul>
    </div>
  );
}
