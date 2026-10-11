import { Link } from "react-router-dom";
import { getProfile, listBookingsByClass, listClasses, listClassTypes, listLocations } from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/format";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SchedulePage() {
  const classes = listClasses();
  const locations = listLocations();
  const classTypes = listClassTypes();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jadwal Kelas</h1>
        <Link to="/admin/schedule/new" className={buttonVariants({})}>
          Tambah Kelas
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Pelatih</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => {
            const coach = getProfile(cls.instructorId);
            const location = locations.find((l) => l.id === cls.locationId);
            const classType = classTypes.find((t) => t.id === cls.classTypeId);
            const bookedCount = listBookingsByClass(cls.id).length;
            return (
              <TableRow key={cls.id}>
                <TableCell>
                  {formatDateTime(cls.startTime)} — {formatTime(cls.endTime)}
                </TableCell>
                <TableCell>{coach?.fullName ?? "-"}</TableCell>
                <TableCell>{location?.name ?? "-"}</TableCell>
                <TableCell>{classType?.name ?? "-"}</TableCell>
                <TableCell>
                  {bookedCount} / {cls.capacity}
                </TableCell>
                <TableCell>
                  <Link
                    to={`/admin/schedule/${cls.id}`}
                    className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Kelola
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
          {classes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Belum ada jadwal kelas.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
