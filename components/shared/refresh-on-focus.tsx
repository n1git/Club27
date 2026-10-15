"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MIN_GAP_MS = 15000;

export function RefreshOnFocus() {
  const router = useRouter();
  const last = useRef(0);

  useEffect(() => {
    last.current = Date.now();
    function refresh() {
      if (document.visibilityState !== "visible" || Date.now() - last.current < MIN_GAP_MS) return;
      last.current = Date.now();
      router.refresh();
    }
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
