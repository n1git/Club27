import Link from "next/link";
import { requireHeadCoach } from "@/lib/auth/head-coach";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCoaches } from "@/lib/data/lookups";
import { getJakartaDayRangeIso, formatJakartaDateTime, formatJakartaTime } from "@/lib/format";
import { SubstituteForm } from "@/components/schedule/substitute-form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

interface ClassRow {
  id: string;
  start_time: string;
  end_time: string;
  instructor_id: string;
  substitute_id: string | null;
  instructor: { full_name: string } | null;
  locations: { name: string } | null;
  class_types: { name: string } | null;
}

export default async function HeadCoachSchedulePage() {
  await requireHeadCoach();
  const supabase = await createServerSupabaseClient();
  const [{ data }, coaches] = await Promise.all([
    supabase
      .from("classes")
      .select(
        "id, start_time, end_time, instructor_id, substitute_id, instructor:profiles!classes_instructor_id_fkey(full_name), locations(name), class_types(name)"
      )
      .gte("start_time", getJakartaDayRangeIso().start)
      .order("start_time"),
    getActiveCoaches(),
  ]);
  const classes = (data ?? []) as unknown as ClassRow[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Semua Jadwal</>} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Kelas</TableHead>
            <TableHead>Pelatih</TableHead>
            <TableHead>Pengganti</TableHead>
            <TableHead>Presensi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => (
            <TableRow key={cls.id}>
              <TableCell>
                {formatJakartaDateTime(cls.start_time)} — {formatJakartaTime(cls.end_time)}
              </TableCell>
              <TableCell>
                {cls.class_types?.name ?? "-"}
                <span className="block text-xs text-muted-foreground">{cls.locations?.name ?? "-"}</span>
              </TableCell>
              <TableCell>{cls.instructor?.full_name ?? "-"}</TableCell>
              <TableCell>
                <SubstituteForm
                  classId={cls.id}
                  instructorId={cls.instructor_id}
                  substituteId={cls.substitute_id}
                  coaches={coaches}
                />
              </TableCell>
              <TableCell>
                <Link
                  href={`/coach/attendance/${cls.id}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-accent-foreground underline-offset-2 hover:underline md:min-h-6"
                >
                  Lihat
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {classes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada kelas mendatang.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
