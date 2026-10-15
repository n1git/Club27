import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Lookup } from "@/lib/data/lookups";
import { getJakartaDateString } from "@/lib/format";

export interface MemberDefaults {
  full_name?: string;
  date_of_birth?: string;
  coach_id?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  preferred_location_id?: string | null;
  address?: string | null;
  notes?: string | null;
}

export function MemberFields({
  coaches,
  locations,
  defaults = {},
  onNameChange,
  onBirthDateChange,
}: {
  coaches: Lookup[];
  locations: Lookup[];
  defaults?: MemberDefaults;
  onNameChange?: (value: string) => void;
  onBirthDateChange?: (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nama Anggota</Label>
          <Input
            id="fullName"
            name="fullName"
            required
            maxLength={200}
            defaultValue={defaults.full_name}
            onChange={onNameChange ? (e) => onNameChange(e.target.value) : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateOfBirth">Tanggal Lahir</Label>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            required
            min="1900-01-01"
            max={getJakartaDateString()}
            defaultValue={defaults.date_of_birth}
            onChange={onBirthDateChange ? (e) => onBirthDateChange(e.target.value) : undefined}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="coachId">Pelatih</Label>
          <Select
            id="coachId"
            name="coachId"
            required
            defaultValue={defaults.coach_id ?? ""}
            aria-describedby={coaches.length === 0 ? "coachId-empty" : undefined}
          >
            <option value="" disabled>
              Pilih pelatih
            </option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          {coaches.length === 0 ? (
            <p id="coachId-empty" className="text-sm text-muted-foreground">
              Setiap anggota wajib punya pelatih, dan belum ada pelatih aktif.{" "}
              <Link href="/admin/coaches/new" className="font-medium text-accent-foreground underline underline-offset-4">
                Tambah pelatih dulu
              </Link>
              .
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="preferredLocationId">Lokasi Kolam Pilihan</Label>
          <Select id="preferredLocationId" name="preferredLocationId" defaultValue={defaults.preferred_location_id ?? ""}>
            <option value="">— Tidak ditentukan —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactName">Nama Kontak</Label>
          <Input id="contactName" name="contactName" defaultValue={defaults.contact_name ?? ""} maxLength={200} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contactPhone">Telepon Kontak</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={defaults.contact_phone ?? ""} maxLength={30} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Alamat</Label>
        <Textarea id="address" name="address" defaultValue={defaults.address ?? ""} maxLength={2000} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Catatan</Label>
        <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} maxLength={2000} />
      </div>
    </>
  );
}
