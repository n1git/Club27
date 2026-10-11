import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  createBooking,
  deleteClass,
  getChild,
  getProfile,
  listBookingsByClass,
  listChildren,
  listClasses,
  listClassTypes,
  listLocations,
  removeBooking,
} from "@/lib/db";
import { formatDateTime, formatTime } from "@/lib/format";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [, forceRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState("");

  const swimClass = id ? listClasses().find((c) => c.id === id) : undefined;
  if (!id || !swimClass) return <Navigate to="/admin/schedule" replace />;

  const coach = getProfile(swimClass.instructorId);
  const location = listLocations().find((l) => l.id === swimClass.locationId);
  const classType = listClassTypes().find((t) => t.id === swimClass.classTypeId);
  const bookings = listBookingsByClass(id);
  const bookedChildIds = new Set(bookings.map((b) => b.childId));
  const availableChildren = listChildren().filter((c) => c.isActive && !bookedChildIds.has(c.id));

  function handleDelete() {
    if (!window.confirm(`Hapus kelas ini beserta ${bookings.length} pendaftaran yang ada? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    deleteClass(id!);
    toast.success("Kelas dihapus");
    navigate("/admin/schedule");
  }

  function handleAddBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!selectedChildId) {
      setError("Pilih anak yang akan didaftarkan");
      return;
    }
    const result = createBooking(selectedChildId, id!);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSelectedChildId("");
    forceRefresh((n) => n + 1);
  }

  function handleRemoveBooking(bookingId: string) {
    removeBooking(bookingId);
    forceRefresh((n) => n + 1);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink to="/admin/schedule" label="Jadwal Kelas" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{classType?.name ?? "Kelas"}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(swimClass.startTime)} — {formatTime(swimClass.endTime)} · {location?.name} ·{" "}
            {coach?.fullName}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          Hapus Kelas
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Peserta ({bookings.length} / {swimClass.capacity})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Anak</TableHead>
                <TableHead>Kehadiran</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const child = getChild(booking.childId);
                return (
                  <TableRow key={booking.id}>
                    <TableCell>{child?.fullName ?? "-"}</TableCell>
                    <TableCell>{booking.isAttended ? "Hadir" : "Belum"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveBooking(booking.id)}>
                        Batalkan Pendaftaran
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {bookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Belum ada peserta.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <form onSubmit={handleAddBooking} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="flex-1"
            >
              <option value="">Pilih anak untuk didaftarkan</option>
              {availableChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </Select>
            <Button type="submit">Daftarkan</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
