"use client";

import { useEffect, useState } from "react";
import { fetchCheckinToken } from "@/lib/actions/checkin";

const REFRESH_MS = 20_000;

export function QrScreen({ pointId, pointName, clubName }: { pointId: string; pointName: string; clubName: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await fetchCheckinToken(pointId);
      if (cancelled) return;
      if (!result.token) {
        setFailed(true);
        return;
      }
      const { default: qrcode } = await import("qrcode-generator");
      if (cancelled) return;
      const qr = qrcode(0, "M");
      qr.addData(`${window.location.origin}/checkin?p=${pointId}&t=${result.token}`);
      qr.make();
      setSvg(qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }));
      setFailed(false);
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pointId]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6 text-center">
      <div>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{clubName}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{pointName}</p>
      </div>
      <div className="aspect-square w-full max-w-[min(80vh,32rem)] rounded-xl bg-white p-4 shadow-lg">
        {svg ? (
          <div className="size-full [&>svg]:size-full" role="img" aria-label="Kode QR check-in" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-neutral-600">Memuat kode...</div>
        )}
      </div>
      <p className="text-lg font-medium">Pindai dengan ponsel Anda untuk check-in</p>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {failed ? "Gagal memperbarui kode. Mencoba lagi..." : "Kode diperbarui otomatis setiap 20 detik"}
      </p>
    </div>
  );
}
