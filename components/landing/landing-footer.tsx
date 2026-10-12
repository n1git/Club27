import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { getContact } from "@/lib/site";
import { LANDING_LINKS } from "./nav-links";

export function LandingFooter() {
  const contact = getContact();
  const linkClass = "rounded-sm transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 text-sm text-muted-foreground sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="font-heading text-base font-semibold text-primary">{APP_NAME}</p>
          <p>Aplikasi pengelolaan klub olahraga: anggota, jadwal, booking, tagihan, kasir, dan buku kas.</p>
        </div>
        <nav aria-label="Bagian halaman">
          <p className="mb-3 font-semibold text-foreground">Produk</p>
          <ul className="flex flex-col gap-2">
            {LANDING_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className={linkClass}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {contact.email || contact.whatsappUrl ? (
          <div>
            <p className="mb-3 font-semibold text-foreground">Kontak</p>
            <ul className="flex flex-col gap-2">
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`} className={linkClass}>{contact.email}</a>
                </li>
              ) : null}
              {contact.whatsappUrl ? (
                <li>
                  <a href={contact.whatsappUrl} className={linkClass} rel="noopener noreferrer" target="_blank">
                    WhatsApp
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {APP_NAME}. Waktu di aplikasi ditampilkan dalam WIB.</p>
          <nav aria-label="Legal" className="flex gap-4">
            <Link href="/privasi" className={`${linkClass} inline-flex min-h-6 items-center`}>Kebijakan privasi</Link>
            <Link href="/syarat" className={`${linkClass} inline-flex min-h-6 items-center`}>Syarat & ketentuan</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
