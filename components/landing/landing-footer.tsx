import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getContact } from "@/lib/site";
import { LEGAL_OPERATORS, LEGAL_OPERATORS_URL } from "@/lib/legal";

const linkClass =
  "inline-flex min-h-6 items-center rounded-sm transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

function FooterGroup({
  title,
  links,
  className,
  children,
}: {
  title: string;
  links: FooterLink[];
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <nav aria-label={title} className={className}>
      <p className="mb-3 font-heading text-base font-semibold text-foreground">{title}</p>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} className={linkClass} rel="noopener noreferrer" target="_blank">
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}

export function LandingFooter() {
  const contact = getContact();

  const services: FooterLink[] = [
    { href: "/#olahraga", label: "Olahraga" },
    { href: "/#fitur", label: "Fitur" },
    { href: "/#multi-klub", label: "Multi klub" },
    { href: "/#harga", label: "Harga" },
  ];
  const community: FooterLink[] = [
    { href: "/#cara-kerja", label: "Cara kerja" },
    { href: "/#faq", label: "FAQ" },
    ...(contact.whatsappUrl ? [{ href: contact.whatsappUrl, label: "WhatsApp", external: true }] : []),
  ];
  const about: FooterLink[] = contact.email ? [{ href: `mailto:${contact.email}`, label: "Hubungi kami" }] : [];

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 text-sm text-muted-foreground sm:px-6">
        <BrandLogo />
        <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
          <FooterGroup title="Layanan" links={services} />
          <FooterGroup title="Komunitas" links={community} />
          <FooterGroup title="Tentang kami" links={about} className="col-span-2 sm:col-span-1">
            <li>
              <a href={LEGAL_OPERATORS_URL} className={linkClass} rel="noopener" target="_blank">
                Dikelola oleh {LEGAL_OPERATORS}
              </a>
            </li>
            <li className="flex flex-wrap items-center gap-x-2">
              <Link href="/syarat" className={linkClass}>
                Syarat & ketentuan
              </Link>
              <span aria-hidden="true">•</span>
              <Link href="/privasi" className={linkClass}>
                Privasi
              </Link>
            </li>
          </FooterGroup>
        </div>
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {APP_NAME}. Hak cipta dilindungi.
        </p>
      </div>
    </footer>
  );
}
