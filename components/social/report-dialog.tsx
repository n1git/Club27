"use client";

import { reportContent } from "@/lib/actions/social";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { TriggerDialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReportDialog({ targetType, targetId }: { targetType: "post" | "comment" | "account"; targetId: string }) {
  return (
    <TriggerDialog trigger={<span className="cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline">Laporkan</span>}>
      <h2 className="mb-4 text-lg font-semibold">Laporkan</h2>
      <ActionForm action={reportContent} className="flex flex-col gap-3">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`report-${targetId}`}>Alasan</Label>
          <Textarea id={`report-${targetId}`} name="reason" required minLength={5} maxLength={500} rows={3} />
        </div>
        <ActionSubmitButton className="w-fit">Kirim laporan</ActionSubmitButton>
      </ActionForm>
    </TriggerDialog>
  );
}
