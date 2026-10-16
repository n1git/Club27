import Link from "next/link";
import { requirePermission } from "@/lib/auth/guard";
import { getEnabledModules } from "@/lib/modules";
import { getClubTerms } from "@/lib/club-type";
import { getLocations } from "@/lib/data/lookups";
import { getResourcePreset, getResources } from "@/lib/data/booking";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Stepper, type OnboardingStep } from "@/components/onboarding/stepper";
import { FinishForm } from "@/components/onboarding/finish-form";
import { LocationForm } from "@/components/settings/location-form";
import { FacilityForm } from "@/components/onboarding/facility-form";
import { PackageForm } from "@/components/billing/package-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  await requirePermission("club.settings");
  const [{ step: requested }, enabled, terms] = await Promise.all([searchParams, getEnabledModules(), getClubTerms()]);

  const steps: OnboardingStep[] = [
    { key: "lokasi", label: terms.location },
    ...(enabled.has("resource_booking") ? [{ key: "fasilitas", label: terms.resource }] : []),
    ...(enabled.has("plans") ? [{ key: "paket", label: "Paket pertama" }] : []),
    { key: "selesai", label: "Selesai" },
  ];
  const current = steps.find((s) => s.key === requested)?.key ?? steps[0].key;
  const index = steps.findIndex((s) => s.key === current);
  const next = steps[index + 1];
  const previous = steps[index - 1];

  const supabase = await createServerSupabaseClient();
  const [locations, { data: packages }, resources, preset] = await Promise.all([
    getLocations(),
    supabase.from("membership_packages").select("id, name").order("created_at"),
    enabled.has("resource_booking") ? getResources() : Promise.resolve([]),
    enabled.has("resource_booking") ? getResourcePreset() : Promise.resolve(null),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={<>Penyiapan klub</>} subtitle={<>Setiap langkah boleh dilewati dan bisa dilengkapi nanti di Pengaturan.</>} />
      <Stepper steps={steps} current={current} />

      {current === "lokasi" ? (
        <Card>
          <CardHeader>
            <CardTitle>{terms.location}</CardTitle>
            <CardDescription>Tempat klub Anda beroperasi. Tambahkan satu atau lebih.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <Badge key={l.id} variant="secondary">
                  {l.name}
                </Badge>
              ))}
              {locations.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada lokasi.</p> : null}
            </div>
            <LocationForm />
          </CardContent>
        </Card>
      ) : null}

      {current === "fasilitas" ? (
        <Card>
          <CardHeader>
            <CardTitle>{terms.resource}</CardTitle>
            <CardDescription>
              Yang bisa dibooking di klub Anda. Isian di bawah sudah disarankan sesuai jenis klub dan bisa diubah.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {resources.map((r) => (
                <Badge key={r.id} variant="secondary">
                  {r.name}
                </Badge>
              ))}
              {resources.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada {terms.resource.toLowerCase()}.</p> : null}
            </div>
            <FacilityForm locations={locations} preset={preset} resourceLabel={terms.resource} />
          </CardContent>
        </Card>
      ) : null}

      {current === "paket" ? (
        <Card>
          <CardHeader>
            <CardTitle>Paket keanggotaan pertama</CardTitle>
            <CardDescription>Paket yang bisa dipilih anggota. Anda bisa menambah paket lain nanti.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {(packages ?? []).map((p) => (
                <Badge key={p.id as string} variant="secondary">
                  {p.name as string}
                </Badge>
              ))}
              {(packages ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Belum ada paket.</p> : null}
            </div>
            <PackageForm />
          </CardContent>
        </Card>
      ) : null}

      {current === "selesai" ? (
        <Card>
          <CardHeader>
            <CardTitle>Klub siap dipakai</CardTitle>
            <CardDescription>
              {locations.length} {terms.location.toLowerCase()}
              {enabled.has("resource_booking") ? `, ${resources.length} ${terms.resource.toLowerCase()}` : ""} dan {(packages ?? []).length} paket tersimpan. Anda bisa
              melengkapinya kapan saja dari menu Pengaturan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FinishForm />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {previous ? (
          <Link href={`/admin/onboarding?step=${previous.key}`} className={buttonVariants({ variant: "outline" })}>
            Kembali
          </Link>
        ) : null}
        {next ? (
          <>
            <Link href={`/admin/onboarding?step=${next.key}`} className={buttonVariants()}>
              Lanjut
            </Link>
            <Link href={`/admin/onboarding?step=selesai`} className={buttonVariants({ variant: "ghost" })}>
              Lewati semua
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
