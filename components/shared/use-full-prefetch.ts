"use client";

import { useEffect, useState } from "react";

const CACHED_PATHS = new Set([
  "/admin/members",
  "/admin/coaches",
  "/admin/staff",
  "/admin/produk",
  "/admin/fasilitas",
  "/admin/promo",
  "/admin/settings",
  "/admin/audit",
  "/admin/klub",
  "/coach/members",
  "/member/klub",
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
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(id);
  }, [cached]);

  return ready ? true : undefined;
}
