import { ProfilePage } from "@/components/profile/profile-page";
import { CreateOrganizationForm } from "@/components/shared/create-organization-form";
import { getActivePlans } from "@/lib/data/platform-pricing";
import { getReadyClubTypes } from "@/lib/club-type";

export default async function PersonalPage() {
  const [plans, clubTypes] = await Promise.all([getActivePlans(), getReadyClubTypes()]);
  return (
    <div className="flex flex-col gap-8">
      <ProfilePage roles={["personal"]} />
      {plans.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Buat organisasi</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Punya klub sendiri? Buat organisasi dengan akun ini. Anda menjadi pemilik utama dan akun ini tetap bisa dipakai sebagai anggota.
          </p>
          <CreateOrganizationForm plans={plans} clubTypes={clubTypes} />
        </section>
      ) : null}
    </div>
  );
}
