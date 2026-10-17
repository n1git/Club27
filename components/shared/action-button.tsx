"use client";

import type { ActionState } from "@/lib/actions/types";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import type { ButtonProps } from "@/components/ui/button";

export function ActionButton({
  action,
  fields,
  label,
  variant = "outline",
  size = "sm",
  confirmMessage,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  confirmMessage?: string;
}) {
  return (
    <ActionForm action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ActionSubmitButton variant={variant} size={size} confirmMessage={confirmMessage}>
        {label}
      </ActionSubmitButton>
    </ActionForm>
  );
}
