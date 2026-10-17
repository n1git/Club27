import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deletePromo } from "@/lib/actions/promo";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { buttonVariants } from "@/components/ui/button";
import { TriggerDialog } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PromoForm } from "@/components/promo/promo-form";
import { ActionForm } from "@/components/shared/action-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function PromoAdminPage() {
  const supabase = await createServerSupabaseClient();
  const { data: promos } = await supabase
    .from("promos")
    .select("id, title, body, image_url, active_from, active_until")
    .order("active_from", { ascending: false });

  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <PageHeader title={<>Promo</>} />
        <TriggerDialog trigger={<span className={buttonVariants({})}>Tambah Promo</span>}>
          <h2 className="mb-4 text-xl font-semibold">Tambah Promo Baru</h2>
          <PromoForm />
        </TriggerDialog>
      </div>

      <h2 className="text-sm font-semibold text-muted-foreground">Semua Promo</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {(promos ?? []).map((p) => {
          const isActive =
            new Date(p.active_from) <= now && (!p.active_until || new Date(p.active_until) >= now);
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="min-w-0 break-words leading-snug">{p.title}</CardTitle>
                <Badge variant={isActive ? "success" : "secondary"} className="shrink-0">
                  {isActive ? "Aktif" : "Tidak Aktif"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{p.body}</p>
                <ActionForm action={deletePromo}>
                  <input type="hidden" name="promoId" value={p.id} />
                  <ActionSubmitButton
                    variant="destructive"
                    size="sm"
                    confirmMessage="Hapus promo ini? Tindakan ini tidak bisa dibatalkan."
                  >
                    Hapus
                  </ActionSubmitButton>
                </ActionForm>
              </CardContent>
            </Card>
          );
        })}
        {(promos ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada promo.</p>
        ) : null}
      </div>
    </div>
  );
}
