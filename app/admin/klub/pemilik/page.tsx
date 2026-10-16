import Link from "next/link";
import { requireOwner } from "@/lib/auth/owner";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { listPendingInvitations } from "@/lib/accounts/invitations";
import { revokeOwnerInvitation } from "@/lib/actions/ownership";
import { formatJakartaDate } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { InviteOwnerForm, TransferOwnershipForm } from "@/components/organization/owner-forms";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function OwnersPage() {
  const owner = await requireOwner();
  const [{ data: members }, invitations] = await Promise.all([
    createAdminSupabaseClient()
      .from("organization_members")
      .select("id, full_name, email, base_role")
      .eq("organization_id", owner.organizationId)
      .eq("is_active", true)
      .in("base_role", ["p_owner", "owner"])
      .order("created_at"),
    listPendingInvitations({ organizationId: owner.organizationId, kind: "owner" }),
  ]);
  const primary = owner.baseRole === "p_owner";
  const others = (members ?? []).filter((m) => m.id !== owner.ownerId && m.base_role === "owner");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={<>Pemilik</>} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Peran</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(members ?? []).map((m) => (
            <TableRow key={m.id as string}>
              <TableCell>{m.full_name}</TableCell>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Badge variant={m.base_role === "p_owner" ? "success" : "outline"}>
                  {m.base_role === "p_owner" ? "Pemilik utama" : "Pemilik"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {invitations.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Undangan menunggu</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Berlaku sampai</TableHead>
                {primary ? <TableHead>Aksi</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.email}</TableCell>
                  <TableCell>{formatJakartaDate(row.expiresAt, { day: "numeric", month: "short", year: "numeric" })}</TableCell>
                  {primary ? (
                    <TableCell>
                      <ActionForm action={revokeOwnerInvitation}>
                        <input type="hidden" name="invitationId" value={row.id} />
                        <ActionSubmitButton size="sm" variant="destructive" confirmMessage="Batalkan undangan ini?">
                          Batalkan
                        </ActionSubmitButton>
                      </ActionForm>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      {primary ? (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Undang pemilik</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pemilik punya akses penuh ke semua klub dan memakai satu seat. Penerima menerima undangan lewat tautan.
            </p>
            <InviteOwnerForm />
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Pindahkan kepemilikan utama</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Pemilik utama bertanggung jawab atas organisasi ini. Penerima harus sudah menjadi pemilik. Tindakan ini dicatat di log audit.
            </p>
            {others.length > 0 ? (
              <TransferOwnershipForm owners={others.map((m) => ({ id: m.id as string, name: `${m.full_name} (${m.email})` }))} />
            ) : (
              <p className="text-sm text-muted-foreground">Undang pemilik lain lebih dulu untuk bisa memindahkan kepemilikan.</p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Hapus organisasi</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Menghapus seluruh organisasi, klub, anggota, dan datanya.{" "}
              <Link href="/admin/klub/hapus" className="font-medium text-destructive underline-offset-4 hover:underline">
                Lanjut ke penghapusan
              </Link>
            </p>
          </section>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Hanya pemilik utama yang dapat mengundang pemilik atau memindahkan kepemilikan.</p>
      )}
    </div>
  );
}
