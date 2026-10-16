"use client";

import { switchContext } from "@/lib/actions/context";
import { ActionForm } from "@/components/shared/action-form";
import { Button } from "@/components/ui/button";

export interface ContextOption {
  key: string;
  label: string;
  detail: string;
}

export function ContextList({ options }: { options: ContextOption[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {options.map((option) => (
        <li key={option.key}>
          <ActionForm action={switchContext} className="flex flex-wrap items-center justify-between gap-2">
            <input type="hidden" name="key" value={option.key} />
            <span className="flex flex-col text-sm">
              <span className="font-medium">{option.label}</span>
              <span className="text-muted-foreground">{option.detail}</span>
            </span>
            <Button type="submit" size="sm" variant="outline">
              Masuk
            </Button>
          </ActionForm>
        </li>
      ))}
    </ul>
  );
}

export function PersonalSwitch() {
  return (
    <ActionForm action={switchContext}>
      <input type="hidden" name="key" value="personal" />
      <Button type="submit" size="sm" variant="outline">
        Akun saya
      </Button>
    </ActionForm>
  );
}
