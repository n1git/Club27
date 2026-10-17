import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function CoachMembers({ coachId }: { coachId: string }) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("club_members")
    .select("id, full_name, is_active")
    .eq("coach_id", coachId)
    .order("full_name");
  const members = data ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Anggota ({members.length})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>
                <Link href={`/admin/members/${m.id}`} className="text-accent-foreground underline-offset-2 hover:underline">
                  {m.full_name}
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={m.is_active ? "success" : "secondary"}>{m.is_active ? "Aktif" : "Nonaktif"}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                Belum ada anggota.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  );
}
