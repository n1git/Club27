import { BrandLogo } from "./brand-logo";
import { NavLink } from "./nav-link";
import type { NavGroup } from "./nav-types";

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar print:hidden sm:flex">
      <div className="flex h-20 shrink-0 items-center border-b border-dashed border-sidebar-border px-4">
        <BrandLogo />
      </div>
      <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {groups.map((group, index) => {
          const headingId = `nav-group-${index}`;
          return (
            <section key={group.label ?? index} aria-labelledby={group.label ? headingId : undefined}>
              {group.label ? (
                <h2 id={headingId} className="px-2 pb-1.5 text-xs font-medium text-sidebar-muted-foreground">
                  {group.label}
                </h2>
              ) : null}
              <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}
