import { requireHeadCoach } from "@/lib/auth/head-coach";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveCoaches } from "@/lib/data/lookups";
import { reassignMemberCoach } from "@/lib/actions/members";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

export default async function HeadCoachMembersPage() {
  await requireHeadCoach();
  const supabase = await createServerSupabaseClient();
  const [{ data }, coaches] = await Promise.all([
    supabase
      .from("club_members")
      .select("id, full_name, coach_id, contact_name, contact_phone")
      .eq("is_active", true)
      .order("full_name"),
    getActiveCoaches(),
  ]);
  const members = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Semua Anggota ({members.length})</>} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Kontak</TableHead>
            <TableHead>Pelatih</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.id}>
              <TableCell>{m.full_name}</TableCell>
              <TableCell>
                {m.contact_name ?? "-"}
                {m.contact_phone ? <span className="block text-xs text-muted-foreground">{m.contact_phone}</span> : null}
              </TableCell>
              <TableCell>
                <ActionForm action={reassignMemberCoach} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="memberId" value={m.id} />
                  <Select name="coachId" defaultValue={m.coach_id ?? ""} aria-label={`Pelatih ${m.full_name}`} className="w-48">
                    <option value="" disabled>
                      Pilih pelatih
                    </option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <ActionSubmitButton size="sm" variant="outline">
                    Simpan
                  </ActionSubmitButton>
                </ActionForm>
              </TableCell>
            </TableRow>
          ))}
          {members.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center text-muted-foreground">
                Belum ada anggota aktif.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
