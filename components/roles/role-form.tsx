"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useActionToast } from "@/components/shared/use-action-toast";
import type { ActionState } from "@/lib/actions/types";
import type { PermissionInfo } from "@/lib/data/roles";

export function RoleForm({
  action,
  permissions,
  initial,
  lockPaid,
  submitLabel,
}: {
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  permissions: PermissionInfo[];
  initial?: { name: string; isPaid: boolean; permissions: string[] };
  lockPaid?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  useActionToast(state, "Tersimpan");
  const grantable = permissions.filter((p) => !p.ownerOnly);
  const modules = [...new Set(grantable.map((p) => p.module))];
  const selected = new Set(initial?.permissions ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nama peran</Label>
        <Input id="name" name="name" defaultValue={initial?.name} required minLength={2} maxLength={60} />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="isPaid"
          defaultChecked={initial?.isPaid}
          disabled={lockPaid}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>
          Staf berbayar (memakai satu seat dan perlu penugasan klub)
          {lockPaid ? <span className="block text-muted-foreground">Tidak bisa diubah selama peran dipakai staf.</span> : null}
        </span>
      </label>
      {lockPaid && initial?.isPaid ? <input type="hidden" name="isPaid" value="on" /> : null}
      <div className="flex flex-col gap-3">
        {modules.map((module) => (
          <fieldset key={module} className="flex flex-col gap-1.5 rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-semibold">{module}</legend>
            {grantable
              .filter((p) => p.module === module)
              .map((p) => (
                <label key={p.code} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p.code}
                    defaultChecked={selected.has(p.code)}
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                  />
                  <span>{p.label}</span>
                </label>
              ))}
          </fieldset>
        ))}
      </div>
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Menyimpan..." : submitLabel}
      </Button>
    </form>
  );
}
