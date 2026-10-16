"use client";

import { useState, useTransition } from "react";
import { simulatePurge, type PurgeSimulation } from "@/lib/actions/purge";
import { Button } from "@/components/ui/button";

export function PurgeSimulator({ organizationId }: { organizationId: string }) {
  const [result, setResult] = useState<PurgeSimulation | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await simulatePurge(organizationId)))}
      >
        {pending ? "Menghitung..." : "Simulasi (tanpa hapus)"}
      </Button>
      {result?.ok === false ? <p className="text-sm text-destructive">{result.error}</p> : null}
      {result?.ok ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
          {Object.entries(result.counts)
            .filter(([, count]) => count > 0)
            .map(([table, count]) => (
              <div key={table} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{table}</dt>
                <dd>{count}</dd>
              </div>
            ))}
        </dl>
      ) : null}
    </div>
  );
}
