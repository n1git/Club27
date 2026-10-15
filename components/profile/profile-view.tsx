import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { updateOwnProfile } from "@/lib/actions/profile";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { formatJakartaDate } from "@/lib/format";
import { formatRupiah, PERIOD_LABEL } from "@/lib/pricing";
import type { BillingPeriod } from "@/lib/pricing";
import type { ProfileData } from "@/lib/data/profile";
import { STATUS_LABEL, type PlatformSubscriptionStatus } from "@/lib/platform-status";
import { DetailList } from "./detail-list";
import { MaskedAmount } from "./masked-amount";
import { ProfileForm } from "./profile-form";

function accountItems(data: ProfileData) {
  const items: { label: string; value: React.ReactNode }[] = [
    { label: "Email", value: data.email },
    { label: "Username", value: data.username },
  ];
  if (data.kind === "owner") {
    items.push(
      { label: "Organisasi", value: data.organizationName },
      {
        label: "Paket",
        value: data.planName
          ? `${data.planName}${data.billingPeriod ? ` (${PERIOD_LABEL[data.billingPeriod as BillingPeriod] ?? data.billingPeriod})` : ""}`
          : "-",
      },
      {
        label: "Status langganan",
        value: data.status ? STATUS_LABEL[data.status as PlatformSubscriptionStatus] ?? data.status : "-",
      }
    );
    if (data.status === "trial" && data.trialEndsAt) items.push({ label: "Trial berakhir", value: formatJakartaDate(data.trialEndsAt) });
    if (data.periodEnd) items.push({ label: "Periode berakhir", value: formatJakartaDate(data.periodEnd) });
  }
  if (data.kind === "staff") {
    items.push(
      { label: "Klub", value: data.clubName },
      { label: "Peran", value: data.isHeadCoach ? `${ROLE_LABEL[data.role]} (kepala pelatih)` : ROLE_LABEL[data.role] }
    );
  }
  return items;
}

export function ProfileView({ data }: { data: ProfileData }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profil Saya" subtitle={data.fullName} breadcrumb={[{ label: "Profil Saya" }]} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Akun</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList items={accountItems(data)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ubah profil</CardTitle>
            {data.kind === "member" ? (
              <CardDescription>Data anggota lainnya dikelola oleh klub.</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <ProfileForm
              action={updateOwnProfile}
              username={data.username}
              fullName={data.kind === "member" ? undefined : data.fullName}
              phone={data.kind === "staff" ? data.phone : undefined}
            />
          </CardContent>
        </Card>

        {data.kind === "owner" ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Klub</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2 text-sm">
                {data.clubs.map((club) => (
                  <li key={club.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{club.name}</span>
                    {club.isActive ? null : <Badge variant="secondary">Nonaktif</Badge>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {data.kind === "member" ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Klub aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                items={data.clubs.map((club) => ({ label: club.name, value: club.coachName ? `Pelatih: ${club.coachName}` : "Belum ada pelatih" }))}
              />
            </CardContent>
          </Card>
        ) : null}

        {data.kind === "staff" && data.coach ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Data pelatih</CardTitle>
              <CardDescription>Diubah oleh admin klub.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <DetailList
                items={[
                  { label: "Spesialisasi", value: data.coach.specialization || "-" },
                  {
                    label: "Tarif per sesi",
                    value: data.coach.sessionRate === null ? "-" : <MaskedAmount value={formatRupiah(data.coach.sessionRate)} />,
                  },
                ]}
              />
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Sertifikasi</h3>
                {data.coach.certifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada sertifikasi.</p>
                ) : (
                  <ul className="flex flex-col gap-2 text-sm">
                    {data.coach.certifications.map((cert) => (
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
        ) : null}

        <Card className="lg:col-span-2">
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
    </div>
  );
}
