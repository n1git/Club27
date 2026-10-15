"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyHourlyChart = dynamic(() => import("./hourly-chart").then((m) => m.HourlyChart), {
  ssr: false,
  loading: () => (
    <div role="status" aria-label="Memuat diagram">
      <Skeleton className="h-64 w-full" />
    </div>
  ),
});
