"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const Toaster = dynamic(() => import("sonner").then((m) => m.Toaster), { ssr: false });

const NO_TOAST_PATHS = new Set(["/", "/login", "/privacy", "/terms"]);
const WAKE_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

export function LazyToaster() {
  const pathname = usePathname();
  const [armed, setArmed] = useState(false);
  const hidden = NO_TOAST_PATHS.has(pathname);

  useEffect(() => {
    if (hidden || armed) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => setArmed(true);
    const afterLoad = () => {
      timer = setTimeout(wake, 1500);
    };
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    WAKE_EVENTS.forEach((e) => window.addEventListener(e, wake, { once: true, passive: true }));
    return () => {
      clearTimeout(timer);
      window.removeEventListener("load", afterLoad);
      WAKE_EVENTS.forEach((e) => window.removeEventListener(e, wake));
    };
  }, [hidden, armed]);

  if (hidden || !armed) return null;
  return <Toaster richColors position="top-center" />;
}
