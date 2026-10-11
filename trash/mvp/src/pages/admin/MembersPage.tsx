import { Link } from "react-router-dom";
import { listChildren, listLocations, getProfile } from "@/lib/db";
import { calculateAge } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MembersPage() {
  const children = listChildren();
  const locations = listLocations();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Anggota</h1>
        <Link to="/admin/members/new" className={buttonVariants({})}>
          Tambah Anggota
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Anak</TableHead>
            <TableHead>Usia</TableHead>
            <TableHead>Orang Tua</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {children.map((child) => {
            const parent = getProfile(child.parentId);
            const location = locations.find((l) => l.id === child.preferredLocationId);
            return (
              <TableRow key={child.id}>
                <TableCell>{child.fullName}</TableCell>
                <TableCell>{calculateAge(child.dateOfBirth)} th</TableCell>
                <TableCell>{parent?.fullName ?? "-"}</TableCell>
                <TableCell>{location?.name ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={child.isActive ? "success" : "secondary"}>
                    {child.isActive ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    to={`/admin/members/${child.id}`}
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Kelola
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
          {children.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada anggota.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
