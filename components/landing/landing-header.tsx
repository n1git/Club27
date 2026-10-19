import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ctaClass } from "./cta";
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
    <header className="sticky top-0 z-40 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="relative mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-8">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandLogo />
        </Link>
        <nav aria-label="Navigasi utama" className="hidden md:block">
          <ul className="flex items-center gap-7 text-base font-semibold text-muted-foreground">
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
            <Link href="/login" className="rounded-full px-3.5 py-2.5 font-bold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Masuk
            </Link>
            <Link href="/signup/account" className={ctaClass("solid", true)}>
              Buat akun gratis
            </Link>
          </div>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
