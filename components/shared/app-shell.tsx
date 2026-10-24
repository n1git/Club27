import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-logo";
import { LogoutButton } from "./logout-button";
import { PersonalSwitch } from "./context-list";
import { MobileNav } from "./mobile-nav";
import { QuickAddButton } from "@/components/personal/quick-add";
import { QuickAddSheet } from "@/components/personal/quick-add-sheet";
import { NavGroupsProvider } from "./nav-context";
import { NavProgressBar, NavProgressProvider } from "./nav-progress";
import type { NavGroup } from "./nav-types";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({
  navGroups,
  fullName,
  profileHref,
  roleLabel,
  clubName,
  tenantSwitcher,
  personalSwitch,
  quickAdd,
  topActions,
  children,
}: {
  navGroups: NavGroup[];
  fullName: string;
  profileHref: string;
  roleLabel: string;
  clubName: string;
  tenantSwitcher?: React.ReactNode;
  personalSwitch?: boolean;
  quickAdd?: boolean;
  topActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const menuGroups: NavGroup[] = [
    { items: [{ href: profileHref, label: fullName, icon: "profile" }] },
    ...navGroups,
  ];
  return (
    <NavGroupsProvider groups={navGroups}>
      <NavProgressProvider>
        <div className="app-ui flex min-h-screen w-full">
          <SidebarNav groups={menuGroups} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="relative flex min-h-[54px] flex-wrap items-center justify-between gap-2 border-b border-dashed border-border bg-card px-4 py-1.5 print:hidden sm:px-6">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="sm:hidden"><BrandIcon className="size-8" /></span>
                <span className="min-w-0 truncate font-heading text-base font-semibold tracking-tight text-accent-foreground">
                  {clubName}
                </span>
                <span className={cn("rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground", quickAdd && "hidden sm:inline-flex")}>
                  {roleLabel}
                </span>
                {tenantSwitcher}
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                {quickAdd ? <QuickAddButton /> : null}
                {topActions}
                <div className={cn("items-center gap-2 sm:gap-3", quickAdd ? "hidden sm:flex" : "flex")}>
                  <ThemeToggle />
                  {personalSwitch ? <PersonalSwitch /> : null}
                  <LogoutButton />
                </div>
              </div>
              <NavProgressBar />
            </header>
            <main className="min-w-0 flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 print:p-0">
              {children}
            </main>
          </div>
          <MobileNav
            groups={menuGroups}
            personal={quickAdd}
            footer={
              quickAdd ? (
                <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-frame)] border border-border bg-card shadow-sm">
                  <li className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm font-medium">
                    Tema
                    <ThemeToggle />
                  </li>
                  <li className="flex min-h-12 items-center justify-between gap-3 px-4 text-sm font-medium">
                    Keluar dari akun
                    <LogoutButton />
                  </li>
                </ul>
              ) : null
            }
          />
          {quickAdd ? <QuickAddSheet /> : null}
        </div>
      </NavProgressProvider>
    </NavGroupsProvider>
  );
}
