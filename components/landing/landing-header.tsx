import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LANDING_LINKS } from "./nav-links";
import { MobileMenu } from "./mobile-menu";

export function SkipLink() {
  return (
    <a
      href="#konten"
      className="sr-only z-50 rounded-md bg-primary px-4 py-3 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Langsung ke konten
    </a>
  );
}

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-md font-heading text-lg font-semibold tracking-tight text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {APP_NAME}
        </Link>
        <nav aria-label="Navigasi utama" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm text-muted-foreground">
            {LANDING_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="rounded-sm transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-2 sm:flex">
            <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
              Masuk
            </Link>
            <Link href="/daftar" className={buttonVariants()}>
              Daftarkan klub
            </Link>
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
