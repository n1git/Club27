"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MaskedAmount({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="tabular-nums" aria-live="polite">
        {shown ? value : "***"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Sembunyikan jumlah" : "Tampilkan jumlah"}
        aria-pressed={shown}
      >
        {shown ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </Button>
    </span>
  );
}
