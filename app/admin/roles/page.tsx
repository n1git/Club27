import { requirePermission } from "@/lib/auth/guard";
import { deleteRole } from "@/lib/actions/roles";
import { getPermissionCatalog, getTenantRoles } from "@/lib/data/roles";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { CreateRoleForm } from "@/components/roles/create-role";
import { EditRoleForm } from "@/components/roles/edit-role";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/page-header";
import { FramedCard } from "@/components/ui/framed-card";

export default async function RolesPage() {
  const user = await requirePermission("roles.manage");
  const [roles, catalog] = await Promise.all([getTenantRoles(user.tenantId), getPermissionCatalog()]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Peran</>} />
        <TriggerDialog trigger={<span className={buttonVariants({})}>Buat Peran</span>} className="max-w-2xl">
          <h2 className="mb-4 text-xl font-semibold">Buat Peran</h2>
          <CreateRoleForm permissions={catalog} />
        </TriggerDialog>
      </div>
      <p className="text-sm text-muted-foreground">
        Peran menentukan apa yang boleh dilakukan staf dan pelatih di semua klub organisasi ini. Perubahan berlaku langsung.
        Peran berbayar memakai satu seat; pelatih dan kasir biasanya tidak berbayar.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <FramedCard
            key={role.id}
            title={
              <span className="flex flex-wrap items-center gap-2">
                {role.name}
                {role.isPaid ? <Badge variant="outline">Berbayar</Badge> : <Badge variant="secondary">Gratis</Badge>}
              </span>
            }
          >
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                {role.permissions.length} izin, dipakai {role.profileCount} akun.
              </p>
              <div className="flex flex-wrap gap-2">
                <TriggerDialog trigger={<span className={buttonVariants({ variant: "outline", size: "sm" })}>Ubah</span>} className="max-w-2xl">
                  <h2 className="mb-4 text-xl font-semibold">Ubah Peran</h2>
                  <EditRoleForm
                    roleId={role.id}
                    permissions={catalog}
                    initial={{ name: role.name, isPaid: role.isPaid, permissions: role.permissions }}
                    lockPaid={role.profileCount > 0}
                  />
                </TriggerDialog>
                {role.profileCount === 0 ? (
                  <ActionForm action={deleteRole}>
                    <input type="hidden" name="roleId" value={role.id} />
                    <ActionSubmitButton size="sm" variant="destructive" confirmMessage="Hapus peran ini?">
                      Hapus
                    </ActionSubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </div>
          </FramedCard>
        ))}
      </div>
    </div>
  );
}
