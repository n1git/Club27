"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyTenantSwitcher = dynamic(() => import("./tenant-switcher").then((m) => m.TenantSwitcher), {
  ssr: false,
  loading: () => <Skeleton className="h-11 w-44 rounded-lg sm:h-8" />,
});
