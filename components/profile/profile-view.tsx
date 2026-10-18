import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { updateCoachProfile, updateOrganizationName, updateOwnProfile } from "@/lib/actions/profile";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import type { BillingPeriod } from "@/lib/pricing";
import type { OrganizationSection, ProfileData } from "@/lib/data/profile";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/platform-status";
import { DetailList } from "./detail-list";
import { MaskedAmount } from "./masked-amount";
import { CoachProfileForm, OrganizationNameForm, ProfileForm } from "./profile-form";

const BASE_ROLE_LABEL: Record<OrganizationSection["baseRole"], string> = {
  p_owner: "Pemilik utama",
  owner: "Pemilik",
  staff: "Staf",
};

function organizationItems(org: OrganizationSection) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "Peran Anda", value: BASE_ROLE_LABEL[org.baseRole] },
    { label: "Jumlah klub", value: org.clubCount },
    { label: "Jumlah staf", value: org.staffCount },
    { label: "Jumlah anggota", value: org.memberCount },
  ];
  if (org.canEdit) {
    items.push(
      {
        label: "Paket",
        value: org.planName
          ? `${org.planName}${org.billingPeriod ? ` (${PERIOD_LABEL[org.billingPeriod as BillingPeriod] ?? org.billingPeriod})` : ""}`
          : "-",
      },
      { label: "Status langganan", value: org.status ? STATUS_LABEL[org.status as PlatformSubscriptionStatus] ?? org.status : "-" }
    );
    if (org.status === "trial" && org.trialEndsAt) items.push({ label: "Trial berakhir", value: formatJakartaDate(org.trialEndsAt) });
    if (org.periodEnd) items.push({ label: "Periode berakhir", value: formatJakartaDate(org.periodEnd) });
  }
  return items;
}

export function ProfileView({ data }: { data: ProfileData }) {
  const { account } = data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profil Saya" subtitle={account.fullName} breadcrumb={[{ label: "Profil Saya" }]} />

      <section aria-labelledby="profile-personal" className="flex flex-col gap-3">
        <h2 id="profile-personal" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Info pribadi
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>Data akun</CardTitle>
            <CardDescription>Berlaku untuk semua klub dan organisasi Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md">
              <ProfileForm
                action={updateOwnProfile}
                email={account.email}
                username={account.username}
                fullName={account.fullName}
                phone={account.phone}
                address={account.address}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {data.organizations.length > 0 ? (
        <section aria-labelledby="profile-organization" className="flex flex-col gap-3">
          <h2 id="profile-organization" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Organisasi
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {data.organizations.map((org) => (
              <Card key={org.id}>
                <CardHeader>
                  <CardTitle>{org.name}</CardTitle>
                  <CardDescription>{org.canEdit ? "Anda bisa mengubah data organisasi." : "Hanya pemilik yang bisa mengubah data organisasi."}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <DetailList items={organizationItems(org)} />
                  {org.canEdit ? <OrganizationNameForm action={updateOrganizationName} organizationId={org.id} name={org.name} /> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {data.coaching.length > 0 ? (
        <section aria-labelledby="profile-coach" className="flex flex-col gap-3">
          <h2 id="profile-coach" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Profil pelatih
          </h2>
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {data.coaching.map((coach) => (
              <Card key={coach.profileId}>
                <CardHeader>
                  <CardTitle>{coach.clubName}</CardTitle>
                  <CardDescription>Tarif dan sertifikasi diubah oleh admin klub.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <DetailList
                    items={[
                      { label: "Peran", value: coach.roleName },
                      { label: "Jumlah anggota", value: coach.memberCount },
                      {
                        label: "Tarif per sesi",
                        value: coach.sessionRate === null ? "-" : <MaskedAmount value={formatRupiah(coach.sessionRate)} />,
                      },
                    ]}
                  />
                  <CoachProfileForm action={updateCoachProfile} profileId={coach.profileId} specialization={coach.specialization} />
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-medium">Sertifikasi</h3>
                    {coach.certifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada sertifikasi.</p>
                    ) : (
                      <ul className="flex flex-col gap-2 text-sm">
                        {coach.certifications.map((cert) => (
                          <li key={cert.id} className="flex flex-wrap justify-between gap-2">
                            <span>
                              {cert.name}
                              {cert.number ? <span className="text-muted-foreground"> · {cert.number}</span> : null}
                            </span>
                            <span className="text-muted-foreground">
                              {cert.validUntil ? `Berlaku s.d. ${formatJakartaDate(cert.validUntil)}` : "Tanpa masa berlaku"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="profile-other" className="flex flex-col gap-3">
        <h2 id="profile-other" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lainnya
        </h2>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {data.memberships.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Keanggotaan klub</CardTitle>
                <CardDescription>Data anggota lainnya dikelola oleh klub.</CardDescription>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={data.memberships.map((m) => ({ label: m.clubName, value: m.coachName ? `Pelatih: ${m.coachName}` : "Belum ada pelatih" }))}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Keamanan</CardTitle>
              <CardDescription>Mengganti kata sandi mengeluarkan semua sesi lain.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-sm">
                <ChangePasswordForm requireCurrent />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
