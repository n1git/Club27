import { Link } from "react-router-dom";
import { listProfilesByRole } from "@/lib/db";
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

export default function CoachesPage() {
  const coaches = listProfilesByRole("coach");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pelatih</h1>
        <Link to="/admin/coaches/new" className={buttonVariants({})}>
          Tambah Pelatih
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Telepon</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coaches.map((coach) => (
            <TableRow key={coach.id}>
              <TableCell>{coach.fullName}</TableCell>
              <TableCell>{coach.email}</TableCell>
              <TableCell>{coach.phone ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={coach.isActive ? "success" : "secondary"}>
                  {coach.isActive ? "Aktif" : "Nonaktif"}
                </Badge>
              </TableCell>
              <TableCell>
                <Link
                  to={`/admin/coaches/${coach.id}`}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  Kelola
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {coaches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada pelatih.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
