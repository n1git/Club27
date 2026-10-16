import { BrandIcon } from "./brand-logo";
import { LogoutButton } from "./logout-button";
import { PersonalSwitch } from "./context-list";
import { MobileNav } from "./mobile-nav";
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
  children,
}: {
  navGroups: NavGroup[];
  fullName: string;
  profileHref: string;
  roleLabel: string;
  clubName: string;
  tenantSwitcher?: React.ReactNode;
  personalSwitch?: boolean;
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
                <BrandIcon className="size-8 sm:hidden" />
                <span className="min-w-0 truncate font-heading text-base font-semibold tracking-tight text-accent-foreground">
                  {clubName}
                </span>
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {roleLabel}
                </span>
                {tenantSwitcher}
              </div>
              <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <ThemeToggle />
                {personalSwitch ? <PersonalSwitch /> : null}
                <LogoutButton />
              </div>
              <NavProgressBar />
            </header>
            <main className="min-w-0 flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-6 print:p-0">
              {children}
            </main>
          </div>
          <MobileNav groups={menuGroups} />
        </div>
      </NavProgressProvider>
    </NavGroupsProvider>
  );
}
