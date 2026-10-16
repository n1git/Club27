import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guard";
import { toggleStaffActive } from "@/lib/actions/staff";
import { getTenantRoles, isInstructorRole } from "@/lib/data/roles";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ResetPasswordForm } from "@/components/shared/reset-password-form";
import { StaffForm } from "@/components/shared/staff-form";
import { StaffRoleSelect } from "@/components/shared/staff-role-select";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";

export default async function StaffPage() {
  const session = await requirePermission("staff.manage");
  const supabase = await createServerSupabaseClient();
  const roles = (await getTenantRoles(session.tenantId)).filter((r) => !isInstructorRole(r));
  const roleById = new Map(roles.map((r) => [r.id, r]));
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_active, org_role_id")
    .in("role", ["owner", "staff"])
    .order("full_name");
  const staff = (data ?? []).filter((p) => p.role === "owner" || (p.org_role_id && roleById.has(p.org_role_id)));
  const isOwner = session.role === "owner";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Staf</>} />
        <TriggerDialog trigger={<span className={buttonVariants({})}>Tambah Staf</span>}>
          <h2 className="mb-4 text-xl font-semibold">Tambah Staf</h2>
          <StaffForm roles={roles} />
        </TriggerDialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Peran</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((p) => {
            const manageable = p.role === "staff" && p.id !== session.id;
            const role = p.org_role_id ? roleById.get(p.org_role_id) : undefined;
            return (
              <TableRow key={p.id}>
                <TableCell>{p.full_name}</TableCell>
                <TableCell>{p.email}</TableCell>
                <TableCell>
                  {manageable ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <StaffRoleSelect profileId={p.id} roleId={p.org_role_id!} roles={roles} />
                      {role?.isPaid ? <Badge variant="outline">Berbayar</Badge> : null}
                    </span>
                  ) : p.role === "owner" ? (
                    "Pemilik"
                  ) : (
                    role?.name
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={p.is_active ? "success" : "secondary"}>{p.is_active ? "Aktif" : "Nonaktif"}</Badge>
                </TableCell>
                <TableCell>
                  {manageable ? (
                    <div className="flex flex-col gap-2">
                      <ActionForm action={toggleStaffActive}>
                        <input type="hidden" name="profileId" value={p.id} />
                        <input type="hidden" name="isActive" value={(!p.is_active).toString()} />
                        <ActionSubmitButton
                          size="sm"
                          variant={p.is_active ? "destructive" : "secondary"}
                          confirmMessage={p.is_active ? "Nonaktifkan staf ini? Staf tidak bisa login sampai diaktifkan kembali." : undefined}
                        >
                          {p.is_active ? "Nonaktifkan" : "Aktifkan Kembali"}
                        </ActionSubmitButton>
                      </ActionForm>
                      {isOwner || !role?.permissions.includes("staff.manage") ? (
                        <ResetPasswordForm profileId={p.id} label="staf" />
                      ) : null}
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {staff.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Belum ada staf.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
