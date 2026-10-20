import Link from "next/link";
import { Banknote, Blocks, Building2, CalendarCheck, CalendarClock, ChartNoAxesColumn, FileDown, IdCard, Landmark, Link as LinkIcon, QrCode, ShieldCheck, ShoppingCart, Smartphone } from "lucide-react";
import type { PublicClubType } from "@/lib/club-type";
import { ArrowDot, ctaClass } from "./cta";
import { Wrap } from "./wrap";

const FEATURES = [
  { icon: Building2, title: "Satu atau banyak klub", text: "Di bawah satu organisasi" },
  { icon: IdCard, title: "Anggota dan paket", text: "Paket keanggotaan" },
  { icon: CalendarCheck, title: "Jadwal kelas dan kehadiran", text: "Per lokasi dan pelatih" },
  { icon: CalendarClock, title: "Booking fasilitas", text: "Lapangan, jalur, atau ruang" },
  { icon: QrCode, title: "Check-in QR berputar", text: "Untuk gym" },
  { icon: ShoppingCart, title: "Kasir", text: "Produk dan pesanan" },
  { icon: Landmark, title: "Buku kas", text: "Setiap pembayaran tercatat" },
  { icon: Banknote, title: "Gaji pelatih", text: "Periode per pelatih" },
  { icon: Smartphone, title: "Portal anggota", text: "Hanya baca, plus booking" },
  { icon: ShieldCheck, title: "Peran dan izin akses", text: "Bisa diatur per peran" },
  { icon: ChartNoAxesColumn, title: "Laporan", text: "Ringkasan untuk pemilik" },
  { icon: LinkIcon, title: "Undangan staf", text: "Lewat tautan" },
  { icon: Blocks, title: "Modul per klub", text: "Mengikuti jenis olahraga" },
  { icon: FileDown, title: "Ekspor data organisasi", text: "Semua waktu memakai WIB" },
];

export function BusinessSection({ types }: { types: PublicClubType[] }) {
  const ready = types.filter((t) => t.status === "ready");
  const soon = types.filter((t) => t.status === "soon");

  return (
    <section id="klub" aria-labelledby="klub-judul" className="scroll-mt-20 py-6 sm:py-6">
      <Wrap>
        <div className="grid gap-9 rounded-[32px] bg-secondary px-5 py-7 sm:p-11 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14 lg:rounded-[40px] lg:p-16">
          <div className="lg:sticky lg:top-[104px] lg:self-start">
            <h2 id="klub-judul" className="text-balance font-display text-[40px] uppercase leading-[0.98] sm:text-5xl lg:text-[58px]">
              Punya klub? Naik kelas dari akun yang sama.
            </h2>
            <p className="mt-[18px] text-lg text-muted-foreground">Pilih Upgrade di akun Anda dan berlangganan. Tanpa membuat akun baru.</p>
            <Link href="/signup" className={`${ctaClass("solid")} mt-7`}>
              Daftarkan klub <ArrowDot />
            </Link>
            {ready.length > 0 ? (
              <div className="mt-[22px] flex flex-wrap items-center gap-2 text-[15px] text-muted-foreground">
                Siap dipakai:
                {ready.map((t) => (
                  <Link key={t.code} href={`/sports/${t.code}`} className="rounded-full bg-card px-3.5 py-1 font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {t.name}
                  </Link>
                ))}
              </div>
            ) : null}
            <p className="mt-3 text-[15px] text-muted-foreground">
              {soon.length > 0 ? `Segera hadir: ${soon.map((t) => t.name).join(", ")}. ` : ""}
              Olahraga lain ditambahkan lewat data.
            </p>
          </div>
          <ul className="grid content-start gap-x-7 gap-y-1.5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3.5 rounded-[14px] px-2.5 py-[11px] transition-colors hover:bg-card/60">
                <span className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <b className="block text-[17px] leading-tight">{title}</b>
                  <span className="mt-0.5 block text-[15px] leading-snug text-muted-foreground">{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Wrap>
    </section>
  );
}
