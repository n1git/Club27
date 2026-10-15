import { Pagination } from "@/components/shared/pagination";
import { pageRange } from "@/lib/pagination";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import {
  getActiveCoaches,
  getLocations,
  getClassTypes,
} from "@/lib/data/lookups";
import { buttonVariants } from "@/components/ui/button";
import { ListFilters } from "@/components/shared/list-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatJakartaDateTime, formatJakartaTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { FramedCard } from "@/components/ui/framed-card";

interface ClassRow {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  profiles: { full_name: string } | null;
  substitute: { full_name: string } | null;
  locations: { name: string } | null;
  class_types: { name: string } | null;
  bookings: { count: number }[];
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    coach?: string;
    location?: string;
    classType?: string;
    page?: string;
  }>;
}) {
  const { coach, location, classType, page: pageParam } = await searchParams;
  const { page, from, to } = pageRange(pageParam);
  const [supabase, session, coaches, locations, classTypes] = await Promise.all(
    [
      createServerSupabaseClient(),
      getSession(),
      getActiveCoaches(),
      getLocations(),
      getClassTypes(),
    ],
  );
  let query = supabase
    .from("classes")
    .select(
      "id, start_time, end_time, capacity, profiles!classes_instructor_id_fkey(full_name), substitute:profiles!classes_substitute_id_fkey(full_name), locations(name), class_types(name), bookings(count)",
      { count: "exact" },
    )
    .order("start_time")
    .order("id");
  if (coach) query = query.eq("instructor_id", coach);
  if (location) query = query.eq("location_id", location);
  if (classType) query = query.eq("class_type_id", classType);
  const { data, count } = await query.range(from, to);

  const classes = (data ?? []) as unknown as ClassRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Jadwal Kelas</>} />
        {session?.app_role === "admin" ? (
          <Link href="/admin/schedule/new" className={buttonVariants({})}>
            Tambah Kelas
          </Link>
        ) : null}
      </div>
      <FramedCard
        tools={
          <ListFilters
            fields={[
              {
                type: "select",
                name: "coach",
                placeholder: "Semua Pelatih",
                options: coaches.map((c) => ({ value: c.id, label: c.name })),
              },
              {
                type: "select",
                name: "location",
                placeholder: "Semua Lokasi",
                options: locations.map((l) => ({ value: l.id, label: l.name })),
              },
              {
                type: "select",
                name: "classType",
                placeholder: "Semua Jenis",
                options: classTypes.map((c) => ({
                  value: c.id,
                  label: c.name,
                })),
              },
            ]}
          />
        }
        bodyClassName="p-0 overflow-hidden"
      >
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
            {classes.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell>
                  {formatJakartaDateTime(cls.start_time)} —{" "}
                  {formatJakartaTime(cls.end_time)}
                </TableCell>
                <TableCell>
                  {cls.profiles?.full_name ?? "-"}
                  {cls.substitute ? (
                    <span className="block text-xs text-muted-foreground">
                      Pengganti: {cls.substitute.full_name}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{cls.locations?.name ?? "-"}</TableCell>
                <TableCell>{cls.class_types?.name ?? "-"}</TableCell>
                <TableCell>
                  {cls.bookings?.[0]?.count ?? 0} / {cls.capacity}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/schedule/${cls.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-accent-foreground underline-offset-2 hover:underline md:min-h-6"
                  >
                    Kelola
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {classes.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada jadwal kelas.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </FramedCard>
      <Pagination
        page={page}
        total={count ?? 0}
        pathname="/admin/schedule"
        params={{ coach, location, classType }}
      />
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
