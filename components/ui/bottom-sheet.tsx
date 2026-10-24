"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [everOpened, setEverOpened] = useState(open);
  if (open && !everOpened) setEverOpened(true);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="menu-sheet m-0 mt-auto max-h-[90dvh] w-dvw max-w-none rounded-t-[var(--radius-frame)] border border-border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 sm:m-auto sm:max-w-lg sm:rounded-[var(--radius-frame)]"
    >
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={() => ref.current?.close()}
            className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto", className)}>{everOpened ? children : null}</div>
      </div>
    </dialog>
  );
}
