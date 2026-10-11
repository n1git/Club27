export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export interface Contact {
  email: string | null;
  whatsapp: string | null;
  whatsappUrl: string | null;
}

export function getContact(): Contact {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
  const digits = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP?.replace(/\D/g, "") || null;
  return { email, whatsapp: digits, whatsappUrl: digits ? `https://wa.me/${digits}` : null };
}
