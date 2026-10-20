import type { Metadata } from "next";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { ResetLinkPasswordForm } from "@/components/shared/reset-link-password-form";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Atur ulang kata sandi", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <AuthPageShell title={APP_NAME} description="Buat kata sandi baru. Semua sesi lama akan keluar.">
      <ResetLinkPasswordForm token={token} />
    </AuthPageShell>
  );
}
