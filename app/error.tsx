"use client";

import { StatusPage } from "@/components/shared/status-page";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      title="Terjadi kesalahan"
      description="Halaman ini gagal dimuat. Data Anda tidak berubah. Coba muat ulang, dan hubungi kami jika masalahnya berlanjut."
      action={
        <Button size="lg" className="h-11 px-6" onClick={reset}>
          Coba lagi
        </Button>
      }
    />
  );
}
