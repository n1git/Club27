"use client";

import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { sendFriendRequest, createPost } from "@/lib/actions/social";
import { addWorkout } from "@/lib/actions/workouts";
import { createStory } from "@/lib/actions/stories";
import type { ActionState } from "@/lib/actions/types";
import { Button, type ButtonProps } from "@/components/ui/button";

export type QuickKind = "post" | "friend" | "workout" | "story";
export type QuickMode = QuickKind | "chooser";
export interface QuickSport {
  code: string;
  label: string;
}

const ACTIONS: Record<QuickKind, (prev: ActionState, data: FormData) => Promise<ActionState>> = {
  post: createPost,
  friend: sendFriendRequest,
  workout: addWorkout,
  story: createStory,
};

const SUCCESS: Record<QuickKind, string> = {
  post: "Postingan dibagikan",
  friend: "Permintaan pertemanan dikirim",
  workout: "Latihan disimpan",
  story: "Cerita dibagikan",
};

const HomeToaster = dynamic(() => import("sonner").then((m) => m.Toaster), { ssr: false });

type ByKind<T> = Record<QuickKind, T>;

interface QuickAddValue {
  canSocial: boolean;
  sports: QuickSport[];
  today: string;
  mode: QuickMode | null;
  pending: ByKind<boolean>;
  formKeys: ByKind<number>;
  submit: (kind: QuickKind, event: FormEvent<HTMLFormElement>) => void;
  setMode: Dispatch<SetStateAction<QuickMode | null>>;
  open: (kind: QuickKind) => void;
  openFor: () => void;
}

const QuickAddContext = createContext<QuickAddValue | null>(null);

export function useQuickAdd() {
  return useContext(QuickAddContext);
}

function modeFor(canSocial: boolean): QuickMode {
  return canSocial ? "chooser" : "workout";
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
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<QuickMode | null>(null);
  const [pending, setPending] = useState<ByKind<boolean>>({ post: false, friend: false, workout: false, story: false });
  const [formKeys, setFormKeys] = useState<ByKind<number>>({ post: 0, friend: 0, workout: 0, story: 0 });
  const open = useCallback((kind: QuickKind) => setMode(kind === "workout" || canSocial ? kind : "workout"), [canSocial]);
  const openFor = useCallback(() => setMode(modeFor(canSocial)), [canSocial]);
  const submit = useCallback(
    async (kind: QuickKind, event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending[kind]) return;
      const data = new FormData(event.currentTarget);
      setMode(null);
      setPending((p) => ({ ...p, [kind]: true }));
      const id = toast.loading("Menambahkan…");
      let result: ActionState;
      try {
        result = await ACTIONS[kind]({}, data);
      } catch {
        result = { ok: false, error: "Terjadi kesalahan. Coba lagi." };
      }
      setPending((p) => ({ ...p, [kind]: false }));
      if (result.error || result.ok === false) {
        toast.error(result.error ?? "Gagal menambahkan", { id });
        setMode((m) => m ?? kind);
        return;
      }
      toast.success(result.message ?? SUCCESS[kind], { id });
      setFormKeys((k) => ({ ...k, [kind]: k[kind] + 1 }));
      router.refresh();
    },
    [pending, router],
  );
  const value = useMemo(
    () => ({ canSocial, sports, today, mode, pending, formKeys, submit, setMode, open, openFor }),
    [canSocial, sports, today, mode, pending, formKeys, submit, open, openFor],
  );
  return (
    <QuickAddContext value={value}>
      {children}
      {pathname === "/" ? <HomeToaster richColors position="top-center" /> : null}
    </QuickAddContext>
  );
}

export function QuickAddButton() {
  const quickAdd = useQuickAdd();
  if (!quickAdd) return null;
  return (
    <Button type="button" size="icon" aria-label="Tambah" aria-haspopup="dialog" title="Tambah" onClick={quickAdd.openFor} className="hidden sm:inline-flex">
      <Plus aria-hidden className="size-4" />
    </Button>
  );
}

export function QuickAddTrigger({ kind, ...props }: ButtonProps & { kind: QuickKind }) {
  const quickAdd = useQuickAdd();
  return <Button type="button" aria-haspopup="dialog" onClick={() => quickAdd?.open(kind)} {...props} />;
}
