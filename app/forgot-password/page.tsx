import type { Metadata } from "next";
import Link from "next/link";
import { AuthPageShell } from "@/components/shared/auth-page-shell";
import { ForgotPasswordForm } from "@/components/shared/forgot-password-form";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: "Lupa kata sandi", robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title={APP_NAME}
      description="Masukkan email akun Anda. Kami kirim tautan untuk membuat kata sandi baru."
      footer={
        <Link href="/login" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
