import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getSession, logout } from "@/lib/auth";

export interface NavItem {
  to: string;
  label: string;
}

export function AppShell({ navItems, roleLabel }: { navItems: NavItem[]; roleLabel: string }) {
  const navigate = useNavigate();
  const session = getSession();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-heading text-base font-semibold tracking-tight text-primary">
            Swimma <span className="text-muted-foreground">(Demo)</span>
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{session?.fullName}</span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Keluar
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col sm:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto bg-sidebar p-2 sm:w-56 sm:flex-col sm:gap-0.5 sm:border-r sm:border-sidebar-border sm:p-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to.split("/").length <= 2}
              className={({ isActive }) =>
                cn(
                  "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
