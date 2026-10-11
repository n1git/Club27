import { requireSuperadmin } from "@/lib/auth/superadmin";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { updateSuperadminProfile } from "@/lib/actions/profile";
import { formatJakartaDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { DetailList } from "@/components/profile/detail-list";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function SuperadminProfilePage() {
  const superadmin = await requireSuperadmin();
  const { data } = await createAdminSupabaseClient()
    .from("superadmins")
    .select("email, full_name, username, totp_enabled_at")
    .eq("id", superadmin.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Profil Saya" subtitle={data?.full_name} breadcrumb={[{ label: "Platform", href: "/superadmin" }, { label: "Profil" }]} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Akun</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              items={[
                { label: "Email", value: data?.email ?? "-" },
                { label: "Username", value: data?.username ?? "-" },
                {
                  label: "Autentikator (TOTP)",
                  value: data?.totp_enabled_at ? `Aktif sejak ${formatJakartaDateTime(data.totp_enabled_at)}` : "Belum aktif",
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ubah profil</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm action={updateSuperadminProfile} username={data?.username ?? ""} fullName={data?.full_name ?? ""} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
