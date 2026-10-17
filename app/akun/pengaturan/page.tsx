import { requireRole } from "@/lib/auth/guard";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function SettingsPage() {
  await requireRole("personal");
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pengaturan" />
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
  );
}
