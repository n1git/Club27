import { CreateOrganizationForm } from "@/components/shared/create-organization-form";
import { PageHeader } from "@/components/ui/page-header";
import { getActivePlans } from "@/lib/data/platform-pricing";
import { getReadyClubTypes } from "@/lib/club-type";
import { requireRole } from "@/lib/auth/guard";

export default async function UpgradePage() {
  await requireRole("personal");
  const [plans, clubTypes] = await Promise.all([getActivePlans(), getReadyClubTypes()]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upgrade"
        subtitle="Fitur sosial dan catatan latihan tetap gratis. Berlangganan hanya untuk mengelola klub: anggota, jadwal, kasir, dan lainnya."
      />
      {plans.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Buat organisasi dengan akun ini. Anda menjadi pemilik utama tanpa daftar ulang, dan akun ini tetap bisa dipakai sebagai anggota.
          </p>
          <CreateOrganizationForm plans={plans} clubTypes={clubTypes} />
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">Paket belum tersedia.</p>
      )}
    </div>
  );
}
