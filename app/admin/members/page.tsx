import { Pagination } from "@/components/shared/pagination";
import { pageRange } from "@/lib/pagination";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLocations } from "@/lib/data/lookups";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListFilters } from "@/components/shared/list-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { FramedCard } from "@/components/ui/framed-card";

interface MemberRow {
  id: string;
  full_name: string;
  date_of_birth: string;
  is_active: boolean;
  contact_name: string | null;
  coach: { full_name: string } | null;
  locations: { name: string } | null;
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    location?: string;
    page?: string;
  }>;
}) {
  const { q, status, location, page: pageParam } = await searchParams;
  const { page, from, to } = pageRange(pageParam);
  const [supabase, locations] = await Promise.all([
    createServerSupabaseClient(),
    getLocations(),
  ]);
  let query = supabase
    .from("members")
    .select(
      "id, full_name, date_of_birth, is_active, contact_name, coach:profiles!coach_id(full_name), locations(name)",
      { count: "exact" },
    )
    .order("full_name")
    .order("id");
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (status) query = query.eq("is_active", status === "active");
  if (location) query = query.eq("preferred_location_id", location);
  const { data, count } = await query.range(from, to);

  const members = (data ?? []) as unknown as MemberRow[];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Anggota</>} />
        <Link href="/admin/members/new" className={buttonVariants({})}>
          Tambah Anggota
        </Link>
      </div>
      <FramedCard
        tools={
          <ListFilters
            fields={[
              {
                type: "search",
                name: "q",
                placeholder: "Cari nama anggota...",
              },
              {
                type: "select",
                name: "status",
                placeholder: "Semua Status",
                options: [
                  { value: "active", label: "Aktif" },
                  { value: "inactive", label: "Nonaktif" },
                ],
              },
              {
                type: "select",
                name: "location",
                placeholder: "Semua Lokasi",
                options: locations.map((l) => ({ value: l.id, label: l.name })),
              },
            ]}
          />
        }
        bodyClassName="p-0 overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama Anggota</TableHead>
              <TableHead>Usia</TableHead>
              <TableHead>Pelatih</TableHead>
              <TableHead>Kontak</TableHead>
              <TableHead>Lokasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.full_name}</TableCell>
                <TableCell>{calculateAge(member.date_of_birth)} th</TableCell>
                <TableCell>{member.coach?.full_name ?? "-"}</TableCell>
                <TableCell>{member.contact_name ?? "-"}</TableCell>
                <TableCell>{member.locations?.name ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={member.is_active ? "success" : "secondary"}>
                    {member.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/members/${member.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-accent-foreground underline-offset-2 hover:underline md:min-h-6"
                  >
                    Kelola
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  Belum ada anggota.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </FramedCard>
      <Pagination
        page={page}
        total={count ?? 0}
        pathname="/admin/members"
        params={{ q, status, location }}
      />
    </div>
  );
}
