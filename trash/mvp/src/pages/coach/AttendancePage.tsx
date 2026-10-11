import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  getChild,
  listBookingsByClass,
  listClasses,
  listClassTypes,
  listLocations,
  markAttendance,
  updateBookingNotes,
} from "@/lib/db";
import { formatTime } from "@/lib/format";
import { BackLink } from "@/components/shared/back-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default function AttendancePage() {
  const { classId } = useParams<{ classId: string }>();
  const [, forceRefresh] = useState(0);
  const [search, setSearch] = useState("");

  const swimClass = classId ? listClasses().find((c) => c.id === classId) : undefined;
  if (!classId || !swimClass) return <Navigate to="/coach" replace />;

  const location = listLocations().find((l) => l.id === swimClass.locationId);
  const classType = listClassTypes().find((t) => t.id === swimClass.classTypeId);
  const bookings = listBookingsByClass(classId);
  const attendedCount = bookings.filter((b) => b.isAttended).length;

  const visibleBookings = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return bookings;
    return bookings.filter((b) => (getChild(b.childId)?.fullName ?? "").toLowerCase().includes(term));
  }, [bookings, search]);

  function handleToggle(bookingId: string, current: boolean) {
    markAttendance(bookingId, !current);
    forceRefresh((n) => n + 1);
  }

  function handleNotesBlur(bookingId: string, previous: string, next: string) {
    if (next === previous) return;
    updateBookingNotes(bookingId, next);
    toast.success("Catatan disimpan");
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink to="/coach" label="Jadwal Saya" />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{classType?.name ?? "Kelas"}</h1>
        <Badge variant={attendedCount === bookings.length && bookings.length > 0 ? "success" : "secondary"}>
          {attendedCount} / {bookings.length} Hadir
        </Badge>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <InfoItem label="Tanggal" value={new Date(swimClass.startTime).toLocaleDateString("id-ID")} />
          <InfoItem label="Waktu" value={`${formatTime(swimClass.startTime)} — ${formatTime(swimClass.endTime)}`} />
          <InfoItem label="Lokasi" value={location?.name ?? "-"} />
          <InfoItem label="Jenis Kelas" value={classType?.name ?? "-"} />
        </CardContent>
      </Card>

      {bookings.length > 5 ? (
        <Input
          placeholder="Cari nama anak..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Anak</TableHead>
            <TableHead>Kehadiran</TableHead>
            <TableHead>Catatan (opsional)</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleBookings.map((booking) => {
            const child = getChild(booking.childId);
            const notes = booking.notes ?? "";
            return (
              <TableRow key={booking.id}>
                <TableCell className="font-medium">{child?.fullName ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={booking.isAttended ? "success" : "outline"}>
                    {booking.isAttended ? "Hadir" : "Belum Hadir"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Input
                    key={booking.id}
                    defaultValue={notes}
                    placeholder="Tambahkan catatan..."
                    className="min-w-40"
                    onBlur={(e) => handleNotesBlur(booking.id, notes, e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant={booking.isAttended ? "outline" : "default"}
                    onClick={() => handleToggle(booking.id, booking.isAttended)}
                  >
                    {booking.isAttended ? "Tandai Belum Hadir" : "Tandai Hadir"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
          {visibleBookings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                {bookings.length === 0 ? "Belum ada peserta terdaftar di kelas ini." : "Tidak ada anak yang cocok dengan pencarian."}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
