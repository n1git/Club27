import { requirePermission } from "@/lib/auth/guard";
import { getClubTerms } from "@/lib/club-type";
import { getLocations } from "@/lib/data/lookups";
import { getAllResourceHours, getResources } from "@/lib/data/booking";
import { RESOURCE_KINDS } from "@/lib/booking";
import { setResourceActive } from "@/lib/actions/resources";
import { formatRupiahFull } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ResourceForm } from "@/components/booking/resource-form";
import { ResourceHoursForm } from "@/components/booking/resource-hours-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TriggerDialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default async function FacilitiesPage() {
  await requirePermission("resources.manage");
  const [terms, locations, resources, hours] = await Promise.all([
    getClubTerms(),
    getLocations(),
    getResources(),
    getAllResourceHours(),
  ]);
  const kindLabel = Object.fromEntries(RESOURCE_KINDS.map((k) => [k.value, k.label]));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>{terms.resource}</>} subtitle={<>Yang bisa dibooking di klub ini, lengkap dengan jam buka dan aturannya.</>}>
        {locations.length > 0 ? (
          <TriggerDialog trigger={<span className={buttonVariants()}>Tambah {terms.resource}</span>}>
            <h2 className="mb-4 text-xl font-semibold">Tambah {terms.resource}</h2>
            <ResourceForm locations={locations} />
          </TriggerDialog>
        ) : null}
      </PageHeader>

      {locations.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">Tambahkan {terms.location.toLowerCase()} dulu sebelum membuat {terms.resource.toLowerCase()}.</p>
          <Link href="/admin/settings" className={buttonVariants({ size: "sm" })}>
            Buka Pengaturan
          </Link>
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Belum ada {terms.resource.toLowerCase()}. Gunakan tombol Tambah di kanan atas.
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Lokasi</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Kapasitas</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resources.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.locationName}</TableCell>
                    <TableCell>{kindLabel[r.kind]}</TableCell>
                    <TableCell>{r.capacity}</TableCell>
                    <TableCell>{r.slotMinutes} mnt</TableCell>
                    <TableCell>{r.pricePerSlot > 0 ? formatRupiahFull(r.pricePerSlot) : "Gratis"}</TableCell>
                    <TableCell>
                      <Badge variant={r.isActive ? "success" : "secondary"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Ubah</span>}>
                          <h2 className="mb-4 text-xl font-semibold">Ubah {r.name}</h2>
                          <ResourceForm locations={locations} resource={r} />
                        </TriggerDialog>
                        <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Jam buka</span>}>
                          <h2 className="mb-4 text-xl font-semibold">Jam buka {r.name}</h2>
                          <ResourceHoursForm resourceId={r.id} hours={hours[r.id] ?? []} />
                        </TriggerDialog>
                        <ActionForm action={setResourceActive}>
                          <input type="hidden" name="resourceId" value={r.id} />
                          <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                          <Button type="submit" variant="ghost" size="sm">
                            {r.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </ActionForm>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
