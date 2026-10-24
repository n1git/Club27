"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Send } from "lucide-react";
import { cn } from "@/lib/utils";

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span aria-hidden="true" className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground">
      {count > 9 ? "9+" : count}
    </span>
  );
}

const BUTTON = "relative flex size-11 items-center justify-center rounded-full text-foreground ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-9";

export function TopBarActions({ notifications, messages }: { notifications: number; messages: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Pintasan" className="flex items-center">
      <Link
        href="/notifications"
        aria-label={notifications ? `Notifikasi, ${notifications} belum dibaca` : "Notifikasi"}
        aria-current={pathname === "/notifications" ? "page" : undefined}
        className={BUTTON}
      >
        <Heart size={22} aria-hidden="true" className={cn(pathname === "/notifications" && "fill-current")} />
        <Badge count={notifications} />
      </Link>
      <Link
        href="/messages"
        aria-label={messages ? `Pesan, ${messages} percakapan belum dibaca` : "Pesan"}
        aria-current={pathname === "/messages" || pathname.startsWith("/messages/") ? "page" : undefined}
        className={BUTTON}
      >
        <Send size={22} aria-hidden="true" className={cn((pathname === "/messages" || pathname.startsWith("/messages/")) && "fill-current")} />
        <Badge count={messages} />
      </Link>
    </nav>
  );
}
