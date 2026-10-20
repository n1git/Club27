import { APP_NAME } from "@/lib/config";
import { getContact } from "@/lib/site";

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
