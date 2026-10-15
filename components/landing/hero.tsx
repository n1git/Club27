import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Hero({ trialDays }: { trialDays: number }) {
  return (
    <section aria-labelledby="hero-judul" className="dark relative overflow-hidden border-b border-border bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
        <div className="max-w-3xl">
          <h1 id="hero-judul" className="text-balance font-display text-5xl uppercase leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
            Satu aplikasi untuk mengelola semua klub olahraga Anda.
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            Anggota, jadwal dan booking fasilitas, tagihan, kasir, dan buku kas dalam satu tempat. Untuk satu klub atau
            beberapa klub di bawah satu organisasi.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/daftar" className={buttonVariants({ size: "lg", className: "h-12 px-6 text-base" })}>
              {trialDays > 0 ? `Coba gratis ${trialDays} hari` : "Daftarkan klub"}
            </Link>
            <a href="#fitur" className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 px-6 text-base" })}>
              Lihat fitur
            </a>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Anggota tidak dibatasi jumlahnya. Harga dihitung per pengguna internal.</p>
        </div>
      </div>
    </section>
  );
}
