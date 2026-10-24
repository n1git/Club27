import Link from "next/link";
import { trialLabel, type PricingPlan } from "@/lib/pricing";
import { APP_NAME } from "@/lib/config";
import { formatRupiahFull } from "@/lib/format";
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
  const plan = plans[0];
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
          , isi nama, email, username (terisi otomatis dan bisa diubah), dan kata sandi. Centang pernyataan bahwa Anda berusia 18 tahun ke atas dan menyetujui Syarat &amp;
          Ketentuan serta Kebijakan Privasi; rinciannya bisa dibuka di bawah centang. Setelah itu Anda langsung masuk ke Beranda. Berikutnya masuk dengan email atau username.
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
          tanpa organisasi dan tanpa kartu. Profil, catatan latihan, rekor, streak, lencana, catatan kesehatan, teman, grup, tantangan, dan gabung klub sebagai anggota tidak
          dikenai biaya.
        </>
      ),
    },
    {
      q: "Siapa yang bisa melihat latihan saya?",
      a: "Catatan latihan, rekor, dan streak bersifat pribadi. Latihan, lencana, atau foto baru tampil di feed teman jika Anda membagikannya. Total latihan tampil di peringkat grup bagi sesama anggota grup, dan di peringkat klub hanya jika Anda mengaktifkannya sendiri.",
    },
    {
      q: "Apa itu tantangan dan lencana?",
      a: "Tantangan adalah target bersama dalam jangka waktu tertentu (sesi, jarak, atau durasi) di grup atau klub. Ikut atau keluar kapan saja. Lencana didapat otomatis dari latihan, misalnya sesi pertama, streak, atau menyelesaikan tantangan. Catatan yang tidak wajar untuk olahraganya ditolak.",
    },
    {
      q: "Apakah catatan kesehatan saya aman?",
      a: "Tinggi dan berat badan hanya bisa dilihat oleh Anda, tidak tampil ke klub, pelatih, teman, grup, feed, atau peringkat. Fitur ini meminta persetujuan terpisah. Jika persetujuan ditarik di Pengaturan, semua catatan kesehatan dihapus.",
    },
    {
      q: "Bagaimana menemukan teman?",
      a: "Cari dengan username yang persis sama. Tidak ada daftar pengguna yang bisa dijelajahi. Anda juga bisa menyalakan profil publik di Profil agar orang lain dapat membuka halaman ruzz Anda lewat username; isinya hanya nama dan @username, dan Anda yang memilih apakah halaman itu boleh muncul di mesin pencari.",
    },
    {
      q: "Bagaimana jika ada konten yang mengganggu?",
      a: "Anda bisa memblokir akun dan melaporkan postingan atau komentar. Postingan yang dilaporkan beberapa orang disembunyikan otomatis sambil ditinjau.",
    },
    {
      q: "Bagaimana mengatur data dan persetujuan saya?",
      a: "Di Pengaturan, Anda bisa melihat persetujuan yang pernah diberikan beserta versi dan tanggalnya, mengekspor data, dan menghapus akun. Bukti persetujuan tetap disimpan tanpa data lain.",
    },
  ];
  const right: { q: string; a: React.ReactNode }[] = [
    {
      q: "Bagaimana cara gabung klub?",
      a: "Minta kode klub ke admin klub, kirim permintaan, lalu tunggu persetujuan admin. Usia minimal 18 tahun. Anak didaftarkan oleh klub dengan persetujuan orang tua atau wali, dan akun anak tidak mendapat fitur sosial seperti teman, feed, grup, tantangan, dan peringkat.",
    },
    {
      q: "Saya pemilik klub, bagaimana cara mulai?",
      a: (
        <>
          Jika sudah punya akun {APP_NAME}, buka Upgrade dari Beranda: akun Anda langsung menjadi pemilik klub tanpa daftar ulang dan tetap bisa dipakai untuk latihan pribadi. Jika
          belum punya akun, buka{" "}
          <Link href="/signup" className={link}>
            Daftarkan klub
          </Link>
          : satu formulir sekaligus membuat akun dan klub pertama Anda. Email yang sudah terdaftar tidak bisa dipakai di Daftarkan klub; masuk dulu, lalu pilih Upgrade.
          {plan?.clubLimit ? ` Satu organisasi bisa mengelola sampai ${plan.clubLimit} klub.` : ""}
        </>
      ),
    },
    ...(plan
      ? [
          {
            q: `Apa saja yang didapat dengan ${plan.name}?`,
            a: `Semua fitur bisnis sesuai jenis olahraga klub, tanpa paket tambahan: anggota dan paket keanggotaan, jadwal kelas dan absensi, tagihan dan buku kas, gaji pelatih, booking fasilitas, kasir, check-in QR, serta tantangan dan peringkat klub.${plan.pricePerUserMonth > 0 ? ` Harganya ${formatRupiahFull(plan.pricePerUserMonth)} per seat per bulan${plan.yearlyFreeMonths > 0 ? `; langganan tahunan gratis ${plan.yearlyFreeMonths} bulan` : ""}.` : ""}`,
          },
        ]
      : []),
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
          Langganan tidak ditagih otomatis; perpanjang dan bayar sebelum periode berakhir. Belum ada: feed publik, chat, notifikasi kudos dan komentar, aplikasi mobile,
          dan pembayaran online untuk tagihan anggota.
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
