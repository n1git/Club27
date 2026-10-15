"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { useLinkStatus } from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { useDelayedFlag } from "./use-delayed-flag";
import { NavIcon } from "./nav-icon";
import type { NavIconKey } from "./nav-types";

interface Reporter {
  report: (id: string, pending: boolean) => void;
  active: boolean;
}

const NavProgressContext = createContext<Reporter>({ report: () => {}, active: false });

export function NavProgressProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const report = useCallback((id: string, isPending: boolean) => {
    setPending((prev) => {
      if (prev.has(id) === isPending) return prev;
      const next = new Set(prev);
      if (isPending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const value = useMemo(() => ({ report, active: pending.size > 0 }), [report, pending]);
  return <NavProgressContext.Provider value={value}>{children}</NavProgressContext.Provider>;
}

export function NavProgressBar() {
  const visible = useDelayedFlag(useContext(NavProgressContext).active);
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 overflow-hidden print:hidden">
        {visible ? <div className="nav-progress h-full w-2/5 bg-accent-foreground" /> : null}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {visible ? "Memuat" : ""}
      </div>
    </>
  );
}

export function NavLinkIcon({ name, className }: { name: NavIconKey; className?: string }) {
  const { pending } = useLinkStatus();
  const id = useId();
  const { report } = useContext(NavProgressContext);
  useEffect(() => {
    report(id, pending);
    return () => report(id, false);
  }, [id, pending, report]);
  const visible = useDelayedFlag(pending);
  return (
    <span className={`relative inline-flex size-5 shrink-0 items-center justify-center ${className ?? ""}`}>
      <NavIcon name={name} className={visible ? "opacity-0" : undefined} />
      {visible ? <Spinner label={null} className="absolute size-4" /> : null}
    </span>
  );
}
