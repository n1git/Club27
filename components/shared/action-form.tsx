"use client";

import { createContext, useActionState, useContext, useEffect } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/actions/types";
import { useActionToast } from "@/components/shared/use-action-toast";

const ActionFormStateContext = createContext<ActionState>({});

export function useActionFormState() {
  return useContext(ActionFormStateContext);
}

export function ActionForm({
  action,
  className,
  children,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});
  useActionToast(state, "Berhasil disimpan");
  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className={className}>
      <ActionFormStateContext value={state}>{children}</ActionFormStateContext>
    </form>
  );
}
