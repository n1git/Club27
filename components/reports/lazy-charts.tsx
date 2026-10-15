"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

function ChartSkeleton() {
  return (
    <div className="relative" role="status" aria-label="Memuat diagram">
      <Skeleton className="mb-3 h-14 w-40" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export const LazyRevenueByProgramChart = dynamic(() => import("./revenue-chart").then((m) => m.RevenueByProgramChart), {
  ssr: false,
  loading: ChartSkeleton,
});

export const LazyCashflowChart = dynamic(() => import("./cashflow-chart").then((m) => m.CashflowChart), {
  ssr: false,
  loading: ChartSkeleton,
});
