import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatJakartaDateTime, formatJakartaTime } from "@/lib/format";
import { isModuleReady } from "@/lib/modules";
import { TriggerDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MemberPortalAccess } from "@/components/members/member-portal-access";
import { ManualCheckinForm } from "@/components/checkin/manual-checkin-form";
import { PageHeader } from "@/components/ui/page-header";

interface ClassRow {
  id: string;
  start_time: string;
  end_time: string;
  capacity: number;
  instructor_id: string;
  substitute_id: string | null;
  locations: { name: string } | null;
  class_types: { name: string } | null;
  bookings: { count: number }[];
}

export default async function CoachSchedulePage() {
  const session = await getSession();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("classes")
    .select("id, start_time, end_time, capacity, instructor_id, substitute_id, locations(name), class_types(name), bookings(count)")
    .or(`instructor_id.eq.${session?.sub},substitute_id.eq.${session?.sub}`)
    .order("start_time");

  const classes = (data ?? []) as unknown as ClassRow[];
  const { data: memberRows } = await supabase
    .from("members")
    .select("id, full_name, contact_name, contact_phone, profile_id")
    .eq("coach_id", session?.sub)
    .eq("is_active", true)
    .order("full_name");
  const members = memberRows ?? [];
  const portalReady = await isModuleReady("member_portal");
  const checkinOn = await isModuleReady("checkin");
  const extraColumns = (portalReady ? 1 : 0) + (checkinOn ? 1 : 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Jadwal Saya</>} />
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
            const substituting = cls.substitute_id === session?.sub;
            const replaced = !substituting && cls.substitute_id !== null;
            return (
            <TableRow key={cls.id}>
              <TableCell>
                <span className="flex flex-wrap items-center gap-2">
                  {formatJakartaDateTime(cls.start_time)} — {formatJakartaTime(cls.end_time)}
                  {substituting ? <Badge variant="warning">Pengganti</Badge> : null}
                  {replaced ? <Badge variant="secondary">Digantikan</Badge> : null}
                </span>
              </TableCell>
              <TableCell>{cls.locations?.name ?? "-"}</TableCell>
              <TableCell>{cls.class_types?.name ?? "-"}</TableCell>
              <TableCell>
                {cls.bookings?.[0]?.count ?? 0} / {cls.capacity}
              </TableCell>
              <TableCell>
                {replaced ? (
                  <span className="text-sm text-muted-foreground">Diajar pelatih pengganti</span>
                ) : (
                  <Link href={`/coach/attendance/${cls.id}`} className={buttonVariants({ size: "sm" })}>
                    Absensi
                  </Link>
                )}
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

      <h2 className="text-xl font-semibold">Anggota Saya ({members.length})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead>Telepon</TableHead>
            {portalReady ? <TableHead>Portal</TableHead> : null}
            {checkinOn ? <TableHead>Check-in</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.full_name}</TableCell>
              <TableCell>{m.contact_name ?? "-"}</TableCell>
              <TableCell>{m.contact_phone ?? "-"}</TableCell>
              {portalReady ? (
                <TableCell>
                  <TriggerDialog
                    trigger={
                      <Button type="button" size="sm" variant="outline">
                        {m.profile_id ? "Kelola akun" : "Aktifkan akun"}
                      </Button>
                    }
                  >
                    <h2 className="mb-4 text-xl font-semibold">{m.full_name}</h2>
                    <MemberPortalAccess memberId={m.id} hasAccount={Boolean(m.profile_id)} />
                  </TriggerDialog>
                </TableCell>
              ) : null}
              {checkinOn ? (
                <TableCell>
                  <TriggerDialog
                    trigger={
                      <Button type="button" size="sm" variant="outline">
                        Check-in manual
                      </Button>
                    }
                  >
                    <h2 className="mb-4 text-xl font-semibold">Check-in manual: {m.full_name}</h2>
                    <ManualCheckinForm memberId={m.id} />
                  </TriggerDialog>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3 + extraColumns} className="text-center text-muted-foreground">
                Belum ada anggota.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
