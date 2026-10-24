"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, Menu, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLinkIcon } from "./nav-progress";
import { useFullPrefetch } from "./use-full-prefetch";
import { NavBadge } from "./nav-link";
import { isNavActive, type NavGroup, type NavItem } from "./nav-types";
import { useQuickAdd } from "@/components/personal/quick-add";

function TabLink({ item, active, className, iconOnly }: { item: NavItem; active: boolean; className: string; iconOnly?: boolean }) {
  const prefetch = useFullPrefetch(item.href);
  return (
    <Link href={item.href} prefetch={prefetch} aria-current={active ? "page" : undefined} aria-label={iconOnly ? item.label : undefined} className={className}>
      <span className={iconOnly ? cn("flex size-10 items-center justify-center rounded-xl ui-transition", active && "bg-foreground/10") : undefined}>
        <span className="relative h-5">
          <NavLinkIcon name={item.icon} />
          <NavBadge count={item.badge} className="absolute -right-3 -top-1.5" />
        </span>
      </span>
      {iconOnly ? null : <span className="max-w-full truncate">{item.label}</span>}
    </Link>
  );
}

const MAX_TABS = 5;
const MIN_TABS = 3;

export function MobileNav({ groups, personal, footer }: { groups: NavGroup[]; personal?: boolean; footer?: React.ReactNode }) {
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const sheetRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const all = groups
    .flatMap((g) => g.items)
    .filter((i) => i.icon !== "profile");
  const fits = all.length < MAX_TABS;
  const chosen = new Set<string>();
  if (!fits) {
    for (const item of all)
      if (item.primary && chosen.size < MAX_TABS - 1) chosen.add(item.href);
    for (const item of all) if (chosen.size < MIN_TABS) chosen.add(item.href);
  }
  const tabs = fits ? all : all.filter((i) => chosen.has(i.href));
  const byHref = (href: string) => all.find((i) => i.href === href);
  const before = personal ? [byHref("/"), byHref("/friends")].filter((i): i is NavItem => Boolean(i)) : [];
  const after = personal ? [byHref("/workouts")].filter((i): i is NavItem => Boolean(i)) : [];
  const columns = personal ? before.length + after.length + 2 : tabs.length + 1;

  useEffect(() => {
    sheetRef.current?.close();
  }, [pathname]);

  const tabClass =
    "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-muted-foreground ui-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-dashed border-border bg-card pb-[env(safe-area-inset-bottom)] print:hidden sm:hidden"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {personal ? (
            <>
              {before.map((item) => (
                <li key={item.href}>
                  <TabLink item={item} iconOnly className={cn(tabClass, "w-full", isNavActive(pathname, item) && "text-foreground")} active={isNavActive(pathname, item)} />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  aria-label="Tambah"
                  aria-haspopup="dialog"
                  onClick={() => quickAdd?.openFor(pathname)}
                  className={cn(tabClass, "w-full")}
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Plus size={20} strokeWidth={2} aria-hidden="true" />
                  </span>
                </button>
              </li>
              {after.map((item) => (
                <li key={item.href}>
                  <TabLink item={item} iconOnly className={cn(tabClass, "w-full", isNavActive(pathname, item) && "text-foreground")} active={isNavActive(pathname, item)} />
                </li>
              ))}
            </>
          ) : (
            tabs.map((item) => {
              const active = isNavActive(pathname, item);
              return (
                <li key={item.href}>
                  <TabLink item={item} className={cn(tabClass, "w-full", active && "text-accent-foreground")} active={active} />
                </li>
              );
            })
          )}
          <li>
            <button
              ref={menuRef}
              type="button"
              aria-haspopup="dialog"
              aria-label={personal ? "Menu" : undefined}
              onClick={() => {
                sheetRef.current?.showModal();
                setMenuOpen(true);
              }}
              className={cn(tabClass, "w-full", personal && menuOpen && "text-foreground")}
            >
              {personal ? (
                <span className={cn("flex size-10 items-center justify-center rounded-xl ui-transition", menuOpen && "bg-foreground/10")}>
                  <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
              ) : (
                <Menu size={20} strokeWidth={1.75} aria-hidden="true" />
              )}
              {personal ? null : <span>Menu</span>}
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={sheetRef}
        aria-label="Menu"
        onClose={() => {
          setMenuOpen(false);
          menuRef.current?.focus();
        }}
        className="menu-sheet m-0 h-dvh max-h-none w-dvw max-w-none bg-background p-0 text-foreground sm:hidden"
      >
        <div className="flex h-full flex-col overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-2">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => sheetRef.current?.close()}
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-col gap-6 p-4">
            {groups.map((group, index) => {
              const headingId = `sheet-group-${index}`;
              return (
                <section
                  key={group.label ?? index}
                  aria-labelledby={group.label ? headingId : undefined}
                >
                  {group.label ? (
                    <h3
                      id={headingId}
                      className="px-1 pb-2 text-sm font-semibold text-muted-foreground"
                    >
                      {group.label}
                    </h3>
                  ) : null}
                  <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-frame)] border border-border bg-card shadow-sm">
                    {group.items.map((item) => {
                      const active = isNavActive(pathname, item);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex min-h-12 items-center gap-3 px-4 text-sm font-medium ui-transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                              active && "text-accent-foreground",
                            )}
                          >
                            <NavLinkIcon name={item.icon} />
                            <span className="flex-1 truncate">
                              {item.label}
                            </span>
                            <NavBadge count={item.badge} />
                            <ChevronRight
                              size={18}
                              aria-hidden="true"
                              className="shrink-0 text-muted-foreground"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {footer}
          </div>
        </div>
      </dialog>
    </>
  );
}
