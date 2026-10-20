import { getLocations, getClassTypes } from "@/lib/data/lookups";
import { getCurrentTenant } from "@/lib/data/tenant";
import { getClubTerms } from "@/lib/club-type";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import { LocationForm } from "@/components/settings/location-form";
import { ClassTypeForm } from "@/components/settings/class-type-form";
import { TenantBrandingForm } from "@/components/settings/tenant-branding-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  const [locations, classTypes, tenant, terms] = await Promise.all([
    getLocations(),
    getClassTypes(),
    getCurrentTenant(),
    getClubTerms(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Pengaturan</>} />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Identitas Klub</CardTitle>
          </CardHeader>
          <CardContent>
            <TenantBrandingForm
              name={tenant?.name ?? ""}
              logoUrl={tenant?.logoUrl ?? null}
              primaryColor={tenant?.primaryColor ?? null}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{terms.location}</CardTitle>
            <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Tambah</span>}>
              <h2 className="mb-4 text-xl font-semibold">Tambah Lokasi</h2>
              <LocationForm />
            </TriggerDialog>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <Badge key={l.id} variant="secondary">
                  {l.name}
                </Badge>
              ))}
              {locations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada lokasi.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Modul</CardTitle>
            <Link href="/admin/modules" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Kelola
            </Link>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aktifkan atau nonaktifkan fitur sesuai kebutuhan klub.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Jenis Kelas</CardTitle>
            <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Tambah</span>}>
              <h2 className="mb-4 text-xl font-semibold">Tambah Jenis Kelas</h2>
              <ClassTypeForm />
            </TriggerDialog>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {classTypes.map((c) => (
                <Badge key={c.id} variant="secondary">
                  {c.name}
                </Badge>
              ))}
              {classTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada jenis kelas.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
