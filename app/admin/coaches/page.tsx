import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { getTenantRoles, isInstructorRole } from "@/lib/data/roles";
import { PendingInvitations } from "@/components/shared/pending-invitations";
import { certificationWarningDate } from "@/lib/certifications";
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

export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const user = await requirePermission("coaches.manage");
  const supabase = await createServerSupabaseClient();
  const tenantRoles = await getTenantRoles(user.tenantId);
  const roleById = new Map(tenantRoles.map((r) => [r.id, r]));
  let query = supabase
    .from("instructors")
    .select("id, full_name, email, phone, is_active, specialization, org_role_id")
    .order("full_name");
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (status) query = query.eq("is_active", status === "active");
  const [{ data: coaches }, { data: expiring }] = await Promise.all([
    query,
    supabase
      .from("coach_certifications")
      .select("coach_id")
      .lte("valid_until", certificationWarningDate()),
  ]);
  const expiringCoachIds = new Set(
    (expiring ?? []).map((c) => c.coach_id as string),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Pelatih</>} />
        <Link href="/admin/coaches/new" className={buttonVariants({})}>
          Undang Pelatih
        </Link>
      </div>
      <FramedCard
        tools={
          <ListFilters
            fields={[
              {
                type: "search",
                name: "q",
                placeholder: "Cari nama pelatih...",
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
            ]}
          />
        }
        bodyClassName="p-0 overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Spesialisasi</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(coaches ?? []).map((coach) => (
              <TableRow key={coach.id}>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-2">
                    {coach.full_name}
                    {roleById.get(coach.org_role_id)?.presetKey !== "pelatih" ? (
                      <Badge variant="outline">{roleById.get(coach.org_role_id)?.name}</Badge>
                    ) : null}
                    {expiringCoachIds.has(coach.id) ? (
                      <Badge variant="warning">
                        Sertifikat perlu diperbarui
                      </Badge>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>{coach.specialization ?? "-"}</TableCell>
                <TableCell>{coach.email}</TableCell>
                <TableCell>{coach.phone ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={coach.is_active ? "success" : "secondary"}>
                    {coach.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/coaches/${coach.id}`}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-accent-foreground underline-offset-2 hover:underline md:min-h-6"
                  >
                    Kelola
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {(coaches ?? []).length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  Belum ada pelatih.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </FramedCard>
      <PendingInvitations tenantId={user.tenantId} roleIds={tenantRoles.filter(isInstructorRole).map((r) => r.id)} />
    </div>
  );
}
