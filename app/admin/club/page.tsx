import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { getOrganizationOverview } from "@/lib/data/organization";
import { getReadyClubTypes } from "@/lib/club-type";
import { CreateTenantButton } from "@/components/organization/create-tenant-form";
import { SwitchTenantButton } from "@/components/organization/switch-tenant-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

export default async function OrganizationPage() {
  const owner = await requireOwner();
  const [overview, clubTypes] = await Promise.all([
    getOrganizationOverview(owner.organizationId, owner.ownerId),
    getReadyClubTypes(),
  ]);
  if (!overview) return null;

  const full = overview.clubLimit !== null && overview.tenants.length >= overview.clubLimit;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <PageHeader title={<>{overview.name}</>} />
          <p className="text-sm text-muted-foreground">
            {overview.tenants.length}{overview.clubLimit !== null ? ` / ${overview.clubLimit}` : ""} klub
            {full ? " — batas tercapai. Hubungi admin platform untuk menambah." : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/club/subscription" className={buttonVariants({ variant: "outline" })}>
            Langganan
          </Link>
          <CreateTenantButton disabled={full} clubTypes={clubTypes} />
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Klub</TableHead>
            <TableHead>Anggota</TableHead>
            <TableHead>Pelatih</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {overview.tenants.map((tenant) => (
            <TableRow key={tenant.id}>
              <TableCell className="font-medium">{tenant.name}</TableCell>
              <TableCell>{tenant.members}</TableCell>
              <TableCell>{tenant.coaches}</TableCell>
              <TableCell>
                <Badge variant={tenant.isActive ? "success" : "secondary"}>{tenant.isActive ? "Aktif" : "Nonaktif"}</Badge>
              </TableCell>
              <TableCell>{tenant.isActive && tenant.id !== owner.tenantId ? <SwitchTenantButton tenantId={tenant.id} /> : tenant.id === owner.tenantId ? "Klub saat ini" : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
