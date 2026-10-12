"use client";

import { useState } from "react";
import type { ActionState } from "@/lib/actions/types";
import { useActionFormState } from "@/components/shared/action-form";

export function RequestIdInput({ state }: { state?: ActionState }) {
  const contextState = useActionFormState();
  const current = state ?? contextState;
  const [seen, setSeen] = useState(current);
  const [id, setId] = useState(() => crypto.randomUUID());
  if (current !== seen) {
    setSeen(current);
    if (current.ok) setId(crypto.randomUUID());
  }
  return <input type="hidden" name="requestId" value={id} />;
}
