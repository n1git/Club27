"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InboxItem } from "@/lib/data/messages";
import { formatRelativeShort } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/social/avatar";

export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  return (
    <ul className="-mx-4 divide-y divide-border sm:mx-0 sm:overflow-hidden sm:rounded-xl sm:border sm:border-border sm:bg-card">
      {items.map((item) => (
        <li key={item.threadId}>
          <Link
            href={`/messages/${item.peer.username}`}
            className="flex items-center gap-3 px-4 py-3 ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Avatar name={item.peer.fullName} src={item.peer.avatarUrl} size={52} />
            <div className="min-w-0 flex-1 text-sm">
              <p className={cn("truncate", item.unread ? "font-semibold" : "font-medium")}>{item.peer.fullName}</p>
              <p className={cn("flex gap-1 text-xs", item.unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                <span className="truncate">{item.preview}</span>
                <span className="shrink-0" suppressHydrationWarning>
                  · {formatRelativeShort(item.lastAt)}
                </span>
              </p>
            </div>
            {item.unread ? (
              <span role="img" aria-label={`${item.unread} pesan belum dibaca`} className="size-2.5 shrink-0 rounded-full bg-primary ring-1 ring-primary-foreground/20" />
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
