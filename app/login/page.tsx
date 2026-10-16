import type { Metadata } from "next";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { LoginForm } from "@/components/shared/login-form";
import { APP_NAME } from "@/lib/config";
import { safeNextPath } from "@/lib/auth/next-path";

export const metadata: Metadata = { title: "Masuk", robots: { index: false, follow: true } };

const NOTICES: Record<string, string> = {
  suspended: `Akses klub Anda sedang dinonaktifkan. Data klub tetap tersimpan. Hubungi admin platform ${APP_NAME} untuk mengaktifkannya kembali.`,
  deactivated: "Akun Anda dinonaktifkan oleh admin klub.",
  revoked: "Sesi Anda berakhir karena kata sandi diubah. Silakan masuk lagi.",
  expired: "Langganan klub Anda sudah berakhir. Data tetap tersimpan. Hubungi pemilik klub untuk memperpanjang.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ suspended?: string; deactivated?: string; revoked?: string; expired?: string; next?: string }>;
}) {
  const params = await searchParams;
  const key = (["suspended", "deactivated", "revoked", "expired"] as const).find((k) => params[k]);
  const notice = key ? NOTICES[key] : null;

  return (
    <AuthPageShell
      title={APP_NAME}
      description="Masuk dengan username atau email dan kata sandi Anda"
      footer={
        <>
          Klub Anda belum terdaftar?{" "}
          <Link href="/daftar" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Daftarkan klub
          </Link>
        </>
      }
    >
      {notice ? (
        <Alert variant="warning">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={safeNextPath(params.next)} />
    </AuthPageShell>
  );
}
