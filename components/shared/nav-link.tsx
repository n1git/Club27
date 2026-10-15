"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavLinkIcon } from "./nav-progress";
import { isNavActive, type NavItem } from "./nav-types";

export function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, item);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "ui-transition flex min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sidebar-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground",
        active && "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <NavLinkIcon name={item.icon} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}
