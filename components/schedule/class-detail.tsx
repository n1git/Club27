import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteClass, removeBooking } from "@/lib/actions/schedule";
import { markAttendance } from "@/lib/actions/attendance";
import { getActiveCoaches } from "@/lib/data/lookups";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddBookingForm } from "@/components/schedule/add-booking-form";
import { SubstituteForm } from "@/components/schedule/substitute-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatJakartaDateTime, formatJakartaTime } from "@/lib/format";

interface ClassInfo {
  start_time: string;
  end_time: string;
  capacity: number;
  instructor_id: string;
  substitute_id: string | null;
  instructor: { full_name: string } | null;
  substitute: { full_name: string } | null;
  locations: { name: string } | null;
  class_types: { name: string } | null;
}

interface BookingRow {
  id: string;
  is_attended: boolean;
  members: { id: string; full_name: string };
}

export async function ClassDetail({ id, canManage, variant }: { id: string; canManage: boolean; variant: "page" | "modal" }) {
  const supabase = await createServerSupabaseClient();
  const isAdmin = canManage;

  const [{ data: cls }, { data: bookings }, coaches] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, start_time, end_time, capacity, instructor_id, substitute_id, instructor:profiles!classes_instructor_id_fkey(full_name), substitute:profiles!classes_substitute_id_fkey(full_name), locations(name), class_types(name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("bookings").select("id, is_attended, members(id, full_name)").eq("class_id", id),
    isAdmin ? getActiveCoaches() : Promise.resolve([]),
  ]);

  if (!cls) notFound();

  const info = cls as unknown as ClassInfo;
  const rows = (bookings ?? []) as unknown as BookingRow[];
  const classStarted = new Date(info.start_time).getTime() <= new Date().getTime();
  const Title = variant === "page" ? "h1" : "h2";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Title className={variant === "page" ? "text-2xl font-semibold" : "text-xl font-semibold"}>
            {info.class_types?.name ?? "Kelas"}
          </Title>
          <p className="text-sm text-muted-foreground">
            {formatJakartaDateTime(info.start_time)} — {formatJakartaTime(info.end_time)} · {info.locations?.name} ·{" "}
            {info.instructor?.full_name}
            {info.substitute ? ` (digantikan oleh ${info.substitute.full_name})` : ""}
          </p>
        </div>
        {isAdmin ? (
          <ActionForm action={deleteClass}>
            <input type="hidden" name="classId" value={id} />
            <ActionSubmitButton
              variant="destructive"
              size="sm"
              confirmMessage={`Hapus kelas ini beserta ${rows.length} pendaftaran yang ada? Tindakan ini tidak bisa dibatalkan.`}
            >
              Hapus Kelas
            </ActionSubmitButton>
          </ActionForm>
        ) : null}
      </div>

      {isAdmin ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Pelatih Pengganti</h3>
          <SubstituteForm
            classId={id}
            instructorId={info.instructor_id}
            substituteId={info.substitute_id}
            coaches={coaches}
          />
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Peserta ({rows.length} / {info.capacity})
        </h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Anggota</TableHead>
              <TableHead>Kehadiran</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell>{booking.members.full_name}</TableCell>
                <TableCell>
                  <Badge variant={booking.is_attended ? "success" : "outline"}>
                    {booking.is_attended ? "Hadir" : "Belum"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <ActionForm action={markAttendance}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="classId" value={id} />
                      <input type="hidden" name="isAttended" value={(!booking.is_attended).toString()} />
                      <Button type="submit" size="sm" variant={booking.is_attended ? "outline" : "default"}>
                        {booking.is_attended ? "Tandai Belum Hadir" : "Tandai Hadir"}
                      </Button>
                    </ActionForm>
                    <ActionForm action={removeBooking}>
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <input type="hidden" name="classId" value={id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Batalkan Pendaftaran
                      </Button>
                    </ActionForm>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Belum ada peserta.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
        <AddBookingForm classId={id} isAdmin={isAdmin} classStarted={classStarted} />
      </section>
    </div>
  );
}
