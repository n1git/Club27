import { Link } from "react-router-dom";
import { getSession } from "@/lib/auth";
import { listBookingsByClass, listClassesByInstructor, listClassTypes, listLocations } from "@/lib/db";
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

export default function CoachSchedulePage() {
  const session = getSession();
  const classes = session ? listClassesByInstructor(session.userId) : [];
  const locations = listLocations();
  const classTypes = listClassTypes();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Jadwal Saya</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Lokasi</TableHead>
            <TableHead>Jenis</TableHead>
            <TableHead>Peserta</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => {
            const location = locations.find((l) => l.id === cls.locationId);
            const classType = classTypes.find((t) => t.id === cls.classTypeId);
            const bookedCount = listBookingsByClass(cls.id).length;
            return (
              <TableRow key={cls.id}>
                <TableCell>
                  {formatDateTime(cls.startTime)} — {formatTime(cls.endTime)}
                </TableCell>
                <TableCell>{location?.name ?? "-"}</TableCell>
                <TableCell>{classType?.name ?? "-"}</TableCell>
                <TableCell>
                  {bookedCount} / {cls.capacity}
                </TableCell>
                <TableCell>
                  <Link to={`/coach/attendance/${cls.id}`} className={buttonVariants({ size: "sm" })}>
                    Absensi
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
          {classes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada kelas terjadwal.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
