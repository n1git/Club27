"use client";

import { cancelOrganizationDeletion } from "@/lib/actions/organization";
import { formatJakartaDate } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PendingDeletions({ items }: { items: { organizationId: string; name: string; purgeAfter: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Alert key={item.organizationId} variant="warning">
          <AlertTitle>{item.name} akan dihapus permanen</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>
              Organisasi ini tidak bisa diakses. Anda bisa memulihkannya sampai{" "}
              {formatJakartaDate(item.purgeAfter, { day: "numeric", month: "long", year: "numeric" })}.
            </span>
            <ActionForm action={cancelOrganizationDeletion} className="flex max-w-sm flex-col gap-3">
              <input type="hidden" name="organizationId" value={item.organizationId} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`restore-${item.organizationId}`}>Kata sandi Anda</Label>
                <Input id={`restore-${item.organizationId}`} name="confirmPassword" type="password" required maxLength={128} autoComplete="current-password" />
              </div>
              <ActionSubmitButton className="w-fit" variant="outline">
                Pulihkan organisasi
              </ActionSubmitButton>
            </ActionForm>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
