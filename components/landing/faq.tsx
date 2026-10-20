import Link from "next/link";
import { trialLabel, type PricingPlan } from "@/lib/pricing";
import { getContact } from "@/lib/site";
import { Wrap } from "./wrap";

const link = "font-semibold text-foreground underline underline-offset-4 hover:text-accent-foreground";

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
          <a href={`mailto:${contact.email}`} className={link}>
            {contact.email}
          </a>
        </>
      ) : null}
      {contact.whatsappUrl ? (
        <>
          {contact.email ? " atau" : ""} lewat{" "}
          <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer" className={link}>
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
  const minSeats = Math.max(1, ...plans.map((p) => p.minSeats));

  const left: { q: string; a: React.ReactNode }[] = [
    {
      q: "Bagaimana cara membuat akun personal?",
      a: (
        <>
          Buka{" "}
          <Link href="/signup/account" className={link}>
            Buat akun
          </Link>
          , isi nama, email, username (terisi otomatis dari email dan bisa diubah), dan kata sandi, lalu setujui syarat dan kebijakan privasi. Setelah itu Anda langsung masuk ke
          Beranda untuk mencatat latihan, menambah teman, dan gabung klub. Berikutnya masuk dengan email atau username.
        </>
      ),
    },
    {
      q: "Apakah akun gratis benar-benar gratis?",
      a: (
        <>
          Ya. Daftar di{" "}
          <Link href="/signup/account" className={link}>
            halaman akun
          </Link>{" "}
          tanpa organisasi dan tanpa kartu. Profil, catatan latihan, teman, grup, dan gabung klub sebagai anggota tidak dikenai biaya.
        </>
      ),
    },
    {
      q: "Siapa yang bisa melihat latihan saya?",
      a: "Catatan latihan bersifat pribadi. Latihan baru tampil di feed teman jika Anda membagikannya. Total latihan Anda tampil di peringkat grup bagi sesama anggota grup, dan di peringkat klub hanya jika Anda mengaktifkannya sendiri.",
    },
    { q: "Bagaimana menemukan teman?", a: "Cari dengan username yang persis sama. Tidak ada daftar pengguna yang bisa dijelajahi." },
    {
      q: "Bagaimana jika ada konten yang mengganggu?",
      a: "Anda bisa memblokir akun dan melaporkan postingan atau komentar. Data akun bisa diekspor, dan akun bisa dihapus sendiri.",
    },
  ];
  const right: { q: string; a: React.ReactNode }[] = [
    {
      q: "Bagaimana cara gabung klub?",
      a: "Minta kode klub ke admin klub, kirim permintaan, lalu tunggu persetujuan admin. Usia minimal 18 tahun; anak-anak didaftarkan oleh klub.",
    },
    {
      q: "Saya pemilik klub, perlu akun baru?",
      a: (
        <>
          Tidak. Naik kelas lewat Upgrade dari akun yang sama, lalu pilih paket. Atau{" "}
          <Link href="/signup" className={link}>
            daftarkan klub
          </Link>{" "}
          langsung.
          {limits ? ` Satu organisasi bisa punya beberapa klub: ${limits}.` : ""}
        </>
      ),
    },
    {
      q: "Siapa yang memakai seat?",
      a: `Pemilik, admin, resepsionis, dan keuangan yang aktif, satu seat per orang di seluruh klub organisasi. Pelatih, kasir, dan anggota tidak memakai seat, dan jumlah anggota tidak dibatasi.${minSeats > 1 ? ` Pembelian minimal ${minSeats} seat.` : ""}`,
    },
    {
      q: "Bagaimana trial dan pembayaran?",
      a: (
        <>
          {trialPlans.length > 0
            ? `${trialPlans.map((p) => `Paket ${p.name} bisa dicoba gratis ${trialLabel(p.trialDays)}`).join("; ")}. Setelah trial berakhir tanpa pembayaran, data tetap tersimpan dan bisa dibaca, tetapi perubahan ditolak sampai pemilik memperpanjang.`
            : "Saat ini tidak ada masa trial. Paket aktif setelah pembayaran diterima."}{" "}
          Belum ada: feed publik, chat, notifikasi kudos dan komentar, aplikasi mobile, dan pembayaran online untuk tagihan anggota.
          <ContactLine />
        </>
      ),
    },
  ];

  return (
    <section id="faq" aria-labelledby="faq-judul" className="scroll-mt-20 pb-14 pt-10 sm:pb-[88px]">
      <Wrap>
        <h2 id="faq-judul" className="max-w-[22ch] text-balance font-display text-[40px] uppercase leading-[0.98] sm:text-5xl lg:text-[64px]">
          Pertanyaan yang sering muncul.
        </h2>
        <div className="mt-11 grid gap-x-[72px] gap-y-[30px] md:grid-cols-2">
          {[left, right].map((column, i) => (
            <dl key={i} className="flex flex-col gap-[30px]">
              {column.map((item) => (
                <div key={item.q}>
                  <dt className="flex items-start gap-3 text-[19px] font-bold leading-snug">
                    <span aria-hidden className="mt-[7px] size-3 shrink-0 rounded bg-primary shadow-[inset_0_0_0_2px_var(--foreground)]" />
                    {item.q}
                  </dt>
                  <dd className="ml-6 mt-1.5 text-pretty text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
          ))}
        </div>
      </Wrap>
    </section>
  );
}
