"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareCardButton({ href, filename, label = "Kartu" }: { href: string; filename: string; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const res = await fetch(href, { cache: "no-store" });
      if (!res.ok) throw new Error("card");
      const blob = await res.blob();
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("Kartu gagal dibuat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={share} disabled={busy} aria-label={`Bagikan ${label.toLowerCase()} sebagai gambar`}>
      <Share2 aria-hidden className="size-4" />
      {busy ? "Membuat..." : label}
    </Button>
  );
}
