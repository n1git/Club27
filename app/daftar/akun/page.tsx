import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { captchaSiteKey } from "@/lib/captcha";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { RegisterAccountForm } from "@/components/shared/register-account-form";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Buat akun", robots: { index: false, follow: true } };

export default async function RegisterAccountPage() {
  const requestHeaders = await headers();
  return (
    <AuthPageShell
      title={`Buat akun ${APP_NAME}`}
      description="Satu akun untuk semua klub Anda. Gratis, tanpa klub terlebih dahulu."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link href="/login" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <RegisterAccountForm captchaSiteKey={captchaSiteKey()} nonce={requestHeaders.get("x-nonce") ?? undefined} />
    </AuthPageShell>
  );
}
