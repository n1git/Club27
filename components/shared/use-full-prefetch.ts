"use client";

import { useEffect, useState } from "react";

const CACHED_PATHS = new Set([
  "/admin/members",
  "/admin/coaches",
  "/admin/staff",
  "/admin/products",
  "/admin/facilities",
  "/admin/promo",
  "/admin/settings",
  "/admin/audit",
  "/admin/club",
  "/coach/members",
  "/member/clubs",
]);

interface ConnectionInfo {
  saveData?: boolean;
  effectiveType?: string;
}

export function useFullPrefetch(href: string): true | undefined {
  const [ready, setReady] = useState(false);
  const cached = CACHED_PATHS.has(href);

  useEffect(() => {
    if (!cached) return;
    const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
    if (connection?.saveData || connection?.effectiveType === "2g" || connection?.effectiveType === "slow-2g") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => {
      timer = setTimeout(() => setReady(true), 1500);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      clearTimeout(timer);
    };
  }, [cached]);

  return ready ? true : undefined;
}
