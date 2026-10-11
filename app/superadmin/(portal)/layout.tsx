import type { Metadata } from "next";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireSuperadmin } from "@/lib/auth/superadmin";
import { SuperadminLogoutButton } from "@/components/superadmin/superadmin-logout-button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Admin platform | ${APP_NAME}`,
  robots: { index: false },
};

export default async function SuperadminPortalLayout({ children }: { children: React.ReactNode }) {
  const superadmin = await requireSuperadmin();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="font-heading text-base font-semibold tracking-tight text-primary">
            {APP_NAME} Platform
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
            Superadmin
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/superadmin/profile"
            className={buttonVariants({ variant: "ghost", size: "sm", className: "max-w-48" })}
            aria-label={`Profil ${superadmin.fullName}`}
          >
            <UserRound className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden truncate sm:inline">{superadmin.fullName}</span>
          </Link>
          <ThemeToggle />
          <SuperadminLogoutButton />
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
