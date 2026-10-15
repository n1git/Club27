import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent } from "@/components/ui/card";
import { AttendanceRoster } from "@/components/attendance/attendance-roster";
import { formatJakartaDate, formatJakartaTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const [supabase, session] = await Promise.all([createServerSupabaseClient(), getSession()]);

  const [{ data: cls }, { data: bookings }] = await Promise.all([
    supabase
      .from("classes")
      .select("id, start_time, end_time, instructor_id, substitute_id, locations(name), class_types(name)")
      .eq("id", classId)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id, is_attended, notes, members(full_name)")
      .eq("class_id", classId),
  ]);

  if (!cls) notFound();

  const info = cls as unknown as {
    instructor_id: string;
    substitute_id: string | null;
    start_time: string;
    end_time: string;
    locations: { name: string } | null;
    class_types: { name: string } | null;
  };

  const roster = (bookings ?? []).map((b) => {
    const booking = b as unknown as {
      id: string;
      is_attended: boolean;
      notes: string | null;
      members: { full_name: string };
    };
    return {
      id: booking.id,
      isAttended: booking.is_attended,
      notes: booking.notes,
      memberName: booking.members.full_name,
    };
  });

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <BackLink href="/coach" label="Jadwal Saya" />
      <PageHeader title={<>{info.class_types?.name ?? "Kelas"}</>} />

      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <InfoItem label="Tanggal" value={formatJakartaDate(info.start_time)} />
          <InfoItem
            label="Waktu"
            value={`${formatJakartaTime(info.start_time)} — ${formatJakartaTime(info.end_time)}`}
          />
          <InfoItem label="Lokasi" value={info.locations?.name ?? "-"} />
          <InfoItem label="Jenis Kelas" value={info.class_types?.name ?? "-"} />
        </CardContent>
      </Card>

      <AttendanceRoster
        classId={classId}
        bookings={roster}
        readOnly={(info.substitute_id ?? info.instructor_id) !== session?.sub}
      />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
