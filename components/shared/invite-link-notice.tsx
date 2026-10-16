"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function InviteLinkNotice({ link, message }: { link?: string; message?: string }) {
  const [copied, setCopied] = useState(false);
  if (!message && !link) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link ?? "");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Alert variant="success">
      <AlertDescription className="flex flex-col gap-2">
        {message ? <span>{message}</span> : null}
        {link ? (
          <>
            <code className="break-all rounded bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">{link}</code>
            <span>
              <Button type="button" size="sm" variant="outline" onClick={copy}>
                {copied ? "Tersalin" : "Salin tautan"}
              </Button>
            </span>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
