"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useFullPrefetch } from "./use-full-prefetch";
import { NavLinkIcon } from "./nav-progress";
import { isNavActive, type NavItem } from "./nav-types";

export function NavBadge({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} baru`}
      className={cn("min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-semibold leading-4 text-primary-foreground", className)}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, item);
  const prefetch = useFullPrefetch(item.href);

  return (
    <Link
      href={item.href}
      prefetch={prefetch}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ui-transition flex min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <NavLinkIcon name={item.icon} />
      <span className="truncate">{item.label}</span>
      <NavBadge count={item.badge} className="ml-auto" />
    </Link>
  );
}
