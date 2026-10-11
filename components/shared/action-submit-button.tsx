"use client";

import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ActionSubmitButton({
  confirmMessage,
  successMessage,
  onClick,
  disabled,
  ...props
}: ButtonProps & { confirmMessage?: string; successMessage?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      {...props}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
          return;
        }
        if (successMessage) toast.success(successMessage);
        onClick?.(event);
      }}
    />
  );
}
