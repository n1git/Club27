import { listPendingInvitations } from "@/lib/accounts/invitations";
import { revokeInvitationAction } from "@/lib/actions/invitations";
import { ResendInvitationForm } from "@/components/shared/resend-invitation-form";
import { formatJakartaDate } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export async function PendingInvitations({ tenantId, roleIds }: { tenantId: string; roleIds: string[] }) {
  const rows = (await listPendingInvitations({ tenantId })).filter((row) => row.roleId && roleIds.includes(row.roleId));
  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Undangan menunggu</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Peran</TableHead>
            <TableHead>Berlaku sampai</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.fullName}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.roleName}</TableCell>
              <TableCell>{formatJakartaDate(row.expiresAt, { day: "numeric", month: "short", year: "numeric" })}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <ResendInvitationForm invitationId={row.id} />
                  <ActionForm action={revokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={row.id} />
                    <ActionSubmitButton size="sm" variant="destructive" confirmMessage="Batalkan undangan ini?">
                      Batalkan
                    </ActionSubmitButton>
                  </ActionForm>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
