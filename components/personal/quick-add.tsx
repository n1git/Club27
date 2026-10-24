"use client";

import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export type QuickKind = "post" | "friend" | "workout";
export type QuickMode = QuickKind | "chooser";
export interface QuickSport {
  code: string;
  label: string;
}

interface QuickAddValue {
  canSocial: boolean;
  sports: QuickSport[];
  today: string;
  mode: QuickMode | null;
  setMode: Dispatch<SetStateAction<QuickMode | null>>;
  open: (kind: QuickKind) => void;
  openFor: (pathname: string) => void;
}

const QuickAddContext = createContext<QuickAddValue | null>(null);

export function useQuickAdd() {
  return useContext(QuickAddContext);
}

function modeFor(pathname: string, canSocial: boolean): QuickMode {
  if (!canSocial) return "workout";
  if (pathname === "/") return "post";
  if (pathname === "/friends" || pathname.startsWith("/friends/")) return "friend";
  if (pathname === "/workouts" || pathname.startsWith("/workouts/")) return "workout";
  return "chooser";
}

export function QuickAddProvider({
  canSocial,
  sports,
  today,
  children,
}: {
  canSocial: boolean;
  sports: QuickSport[];
  today: string;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<QuickMode | null>(null);
  const open = useCallback((kind: QuickKind) => setMode(kind === "workout" || canSocial ? kind : "workout"), [canSocial]);
  const openFor = useCallback((pathname: string) => setMode(modeFor(pathname, canSocial)), [canSocial]);
  const value = useMemo(() => ({ canSocial, sports, today, mode, setMode, open, openFor }), [canSocial, sports, today, mode, open, openFor]);
  return <QuickAddContext value={value}>{children}</QuickAddContext>;
}

export function QuickAddButton() {
  const quickAdd = useQuickAdd();
  const pathname = usePathname();
  if (!quickAdd) return null;
  return (
    <Button type="button" size="icon" aria-label="Tambah" aria-haspopup="dialog" title="Tambah" onClick={() => quickAdd.openFor(pathname)} className="hidden sm:inline-flex">
      <Plus aria-hidden className="size-4" />
    </Button>
  );
}

export function QuickAddTrigger({ kind, ...props }: ButtonProps & { kind: QuickKind }) {
  const quickAdd = useQuickAdd();
  return <Button type="button" aria-haspopup="dialog" onClick={() => quickAdd?.open(kind)} {...props} />;
}
