import { withdrawHealthConsent } from "@/lib/actions/health";
import type { AccountConsent } from "@/lib/data/consents";
import { CONSENT_LABEL, CONSENT_VERSION } from "@/lib/consent";
import { formatJakartaDateTime } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { ConsentDetails } from "@/components/shared/consent-details";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MyConsentsCard({ consents }: { consents: AccountConsent[] }) {
  const terms = consents.find((c) => c.kind === "terms_privacy") ?? null;
  const health = consents.find((c) => c.kind === "health_data" && !c.revokedAt) ?? null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Persetujuan saya</CardTitle>
        <CardDescription>Bukti persetujuan disimpan walau akun dihapus, tanpa data lain.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 text-sm">
        <section className="flex flex-col gap-2">
          <p className="font-medium">Syarat & Ketentuan dan Kebijakan Privasi</p>
          {terms ? (
            <p className="text-muted-foreground">
              Versi {terms.version}, disetujui {formatJakartaDateTime(terms.acceptedAt)} WIB.
            </p>
          ) : (
            <p className="text-muted-foreground">Belum ada catatan persetujuan untuk akun ini.</p>
          )}
          <p>{CONSENT_LABEL}.</p>
          <details>
            <summary className="cursor-pointer font-medium text-accent-foreground">Rincian persetujuan (versi {CONSENT_VERSION})</summary>
            <div className="mt-2">
              <ConsentDetails />
            </div>
          </details>
        </section>
        <section className="flex flex-col gap-2">
          <p className="font-medium">Data kesehatan</p>
          {health ? (
            <>
              <p className="text-muted-foreground">Aktif sejak {formatJakartaDateTime(health.acceptedAt)} WIB.</p>
              <ActionForm action={withdrawHealthConsent} className="flex max-w-sm flex-col gap-3">
                <p>Menarik persetujuan menghapus semua catatan kesehatan Anda secara permanen.</p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="withdraw-confirm">Ketik HAPUS</Label>
                  <Input id="withdraw-confirm" name="confirmText" required autoComplete="off" />
                </div>
                <ActionSubmitButton variant="destructive" className="w-fit">
                  Tarik persetujuan
                </ActionSubmitButton>
              </ActionForm>
            </>
          ) : (
            <p className="text-muted-foreground">Tidak aktif. Persetujuan diminta saat Anda membuka menu Kesehatan.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
