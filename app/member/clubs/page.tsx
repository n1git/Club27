import { requireRole } from "@/lib/auth/guard";
import { listClubsForProfile } from "@/lib/data/member-clubs";
import { SwitchClubButton } from "@/components/member/switch-club-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

export default async function MemberClubsPage() {
  const user = await requireRole("member");
  const clubs = await listClubsForProfile(user.id);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageHeader title={<>{user.clubPending ? "Pilih klub" : "Klub saya"}</>} />
        <p className="text-sm text-muted-foreground">
          {user.clubPending
            ? "Akun Anda terdaftar di lebih dari satu klub. Pilih klub yang ingin dibuka."
            : "Pindah ke klub lain tanpa masuk ulang."}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Klub</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clubs.map((club) => (
            <TableRow key={club.tenantId}>
              <TableCell className="font-medium">{club.tenantName}</TableCell>
              <TableCell>
                {!user.clubPending && club.tenantId === user.tenantId ? (
                  <Badge variant="secondary">Klub saat ini</Badge>
                ) : (
                  <SwitchClubButton tenantId={club.tenantId} />
                )}
              </TableCell>
            </TableRow>
          ))}
          {clubs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                Tidak ada klub aktif.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
