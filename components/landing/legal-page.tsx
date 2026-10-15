import { APP_NAME } from "@/lib/config";
import { getContact } from "@/lib/site";
import { LandingFooter } from "./landing-footer";
import { LandingHeader, SkipLink } from "./landing-header";

export { LEGAL_DOMICILE, LEGAL_OPERATORS } from "@/lib/legal";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LandingHeader />
      <main id="konten" className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Berlaku sejak {updated}</p>
        <div className="mt-8 flex flex-col gap-6 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}

export function LegalContact() {
  const contact = getContact();
  if (!contact.email && !contact.whatsappUrl) {
    return <p>Hubungi pengelola {APP_NAME} melalui kontak yang tercantum di halaman utama.</p>;
  }
  return (
    <ul>
      {contact.email ? (
        <li>
          Email:{" "}
          <a href={`mailto:${contact.email}`} className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            {contact.email}
          </a>
        </li>
      ) : null}
      {contact.whatsappUrl ? (
        <li>
          WhatsApp:{" "}
          <a href={contact.whatsappUrl} className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            +{contact.whatsapp}
          </a>
        </li>
      ) : null}
    </ul>
  );
}
