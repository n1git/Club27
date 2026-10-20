import { getClubModules } from "@/lib/modules";
import { BackLink } from "@/components/shared/back-link";
import { ModuleToggle } from "@/components/modules/module-toggle";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export default async function ModulePage() {
  const modules = await getClubModules();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/admin/settings" label="Pengaturan" />
      <PageHeader title={<>Modul</>} subtitle={<>
          Pilih modul yang dipakai klub ini. Menonaktifkan modul hanya menyembunyikan menu dan halamannya; data tetap
          tersimpan dan kembali saat modul diaktifkan lagi.
        </>} />
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {modules.map((module) => {
          const soon = module.status === "soon";
          const locked = soon || module.code === "members";
          return (
            <li key={module.code} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{module.name}</p>
                  {soon ? <Badge variant="outline">Segera hadir</Badge> : null}
                  {module.code === "members" ? <Badge variant="secondary">Selalu aktif</Badge> : null}
                </div>
                {module.description ? <p className="text-sm text-muted-foreground">{module.description}</p> : null}
              </div>
              <ModuleToggle code={module.code} name={module.name} enabled={module.effective} locked={locked} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
