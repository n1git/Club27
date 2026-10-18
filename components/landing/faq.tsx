import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PricingPlan } from "@/lib/pricing";
import { getContact } from "@/lib/site";
import { Section } from "./section";

function ContactLine() {
  const contact = getContact();
  if (!contact.email && !contact.whatsappUrl) return null;
  return (
    <>
      {" "}
      Hubungi kami
      {contact.email ? (
        <>
          {" "}
          di{" "}
          <a href={`mailto:${contact.email}`} className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            {contact.email}
          </a>
        </>
      ) : null}
      {contact.whatsappUrl ? (
        <>
          {contact.email ? " atau" : ""} lewat{" "}
          <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            WhatsApp
          </a>
        </>
      ) : null}
      .
    </>
  );
}

export function Faq({ plans }: { plans: PricingPlan[] }) {
  const limits = plans.map((p) => `${p.name} ${p.clubLimit ? `sampai ${p.clubLimit} klub` : "tanpa batas klub"}`).join(", ");
  const trialPlans = plans.filter((p) => p.trialDays > 0);

  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: "Siapa yang memakai seat?",
      a: "Pemilik organisasi serta admin, resepsionis, dan keuangan yang aktif, satu seat per orang di seluruh klub organisasi Anda. Pelatih, kasir, dan anggota tidak memakai seat. Bila seat penuh, penambahan ditolak sampai Anda menambah seat; seat tambahan ditagih prorata sesuai sisa periode.",
    },
    {
      q: "Apakah jumlah anggota dibatasi?",
      a: "Tidak. Jumlah anggota dan lokasi tidak dibatasi di paket mana pun.",
    },
    {
      q: "Bisakah saya mengelola beberapa klub?",
      a: (
        <>
          Bisa. Satu organisasi dapat memiliki beberapa klub dengan jenis olahraga berbeda, dan pemilik berpindah klub tanpa
          masuk ulang.{limits ? ` Batasnya mengikuti paket: ${limits}.` : ""}
        </>
      ),
    },
    {
      q: "Bagaimana pembayaran dari anggota dicatat?",
      a: "Dicatat manual oleh admin, resepsionis, atau keuangan: tagihan ditandai lunas, dan pembayaran di kasir dicatat per metode (tunai, transfer, QRIS, atau lainnya). Setiap pembayaran masuk ke buku kas. Belum ada payment gateway untuk pembayaran online.",
    },
    {
      q: "Apakah data klub saya terpisah dari klub lain?",
      a: "Ya. Pemisahan dilakukan di tingkat basis data dengan row level security per klub, bukan hanya di tampilan. Pengguna hanya bisa membaca data klub yang sedang aktif dan sesuai perannya.",
    },
    {
      q: "Apa saja yang termasuk dalam trial?",
      a:
        trialPlans.length > 0 ? (
          <>
            {trialPlans.map((p) => `Paket ${p.name} bisa dicoba gratis ${p.trialDays} hari`).join("; ")} dengan semua modul yang
            tersedia dan batas klub paket tersebut. Setelah trial berakhir tanpa pembayaran, data tetap tersimpan dan bisa
            dibaca, tetapi perubahan ditolak sampai pemilik memperpanjang dan pembayarannya dikonfirmasi.
          </>
        ) : (
          "Saat ini tidak ada paket dengan masa trial. Paket aktif setelah pembayaran diterima."
        ),
    },
    {
      q: "Bagaimana dengan olahraga yang berlabel \"Segera hadir\"?",
      a: (
        <>
          Jenis klub tersebut belum bisa dipilih saat mendaftar. Saat statusnya berubah menjadi tersedia, ia otomatis muncul
          di halaman ini dan di formulir pendaftaran.
          <ContactLine />
        </>
      ),
    },
    {
      q: "Bagaimana cara mulai?",
      a: (
        <>
          Buka{" "}
          <Link href="/signup" className="font-medium text-accent-foreground underline-offset-4 hover:underline">
            halaman pendaftaran
          </Link>
          , isi nama klub, akun pemilik, jenis klub, paket, dan periode. Setelah itu Anda langsung masuk ke penyiapan klub.
          <ContactLine />
        </>
      ),
    },
  ];

  return (
    <Section id="faq" eyebrow="FAQ" title="Pertanyaan yang sering diajukan.">
      <div className="max-w-4xl divide-y divide-border border-y border-t-foreground/80 border-b-border">
        {items.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-semibold">{item.q}</h3>
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <div className="max-w-3xl pb-5 text-pretty text-muted-foreground">{item.a}</div>
          </details>
        ))}
      </div>
    </Section>
  );
}
