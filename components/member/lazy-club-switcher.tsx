"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LazyClubSwitcher = dynamic(() => import("./club-switcher").then((m) => m.ClubSwitcher), {
  ssr: false,
  loading: () => <Skeleton className="h-8 w-44" />,
});
