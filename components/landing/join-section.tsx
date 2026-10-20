import { BadgeCheck, CalendarClock, Check, Hourglass, KeyRound, Smartphone, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wrap } from "./wrap";

function Step({ className, icon: Icon, title, text, children }: { className?: string; icon: typeof KeyRound; title: string; text: string; children: React.ReactNode }) {
  return (
    <li className={cn("relative lg:before:absolute lg:before:-left-11 lg:before:top-24 lg:before:w-8 lg:before:border-t-[3px] lg:before:border-dotted lg:before:border-foreground lg:[&:not(:first-child)]:before:content-['']", className)}>
      <div className="flex min-h-48 flex-col justify-center gap-3 rounded-[28px] bg-card p-[22px] shadow-[0_24px_48px_-20px_rgb(17_18_20/0.28),0_4px_10px_-4px_rgb(17_18_20/0.12)]">{children}</div>
      <h3 className="mt-[22px] flex items-center gap-2.5 text-2xl font-bold">
        <Icon className="size-[26px] shrink-0 text-accent-foreground" strokeWidth={1.75} aria-hidden />
        {title}
      </h3>
      <p className="mt-1.5 text-muted-foreground">{text}</p>
    </li>
  );
}

function Row({ icon: Icon, children }: { icon: typeof Smartphone; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] bg-background px-3 py-2.5 text-[15px] font-semibold">
      <Icon className="size-5 shrink-0 text-accent-foreground" strokeWidth={1.75} aria-hidden />
      {children}
    </div>
  );
}

export function JoinSection() {
  return (
    <section id="gabung" aria-labelledby="gabung-judul" className="scroll-mt-20 py-14 sm:py-[88px]">
      <Wrap>
        <h2 id="gabung-judul" className="max-w-[22ch] text-balance font-display text-[40px] uppercase leading-[0.98] sm:text-5xl lg:text-[64px]">
          Sudah punya klub? Gabung dengan kode.
        </h2>
        <p className="mt-4 max-w-[52ch] text-pretty text-lg text-muted-foreground sm:text-[19px]">Untuk usia 18 tahun ke atas. Anak-anak didaftarkan oleh klub.</p>
        <ol className="mt-12 grid items-start gap-8 lg:mt-14 lg:grid-cols-3 lg:gap-14">
          <Step icon={KeyRound} title="Masukkan kode" text="Minta kode ke admin klub, lalu isi di halaman Gabung klub.">
            <div className="flex flex-col gap-1.5 text-sm font-semibold">
              Kode klub
              <div className="flex h-[50px] items-center rounded-[14px] bg-background px-4 font-mono text-[19px] font-bold tracking-[0.14em] shadow-[inset_0_0_0_2px_var(--foreground)]">7QX4M2</div>
            </div>
            <span className="inline-flex self-start rounded-full bg-primary px-[18px] py-[9px] text-[15px] font-bold text-primary-foreground">Kirim permintaan</span>
          </Step>
          <Step className="lg:mt-11" icon={Hourglass} title="Tunggu persetujuan" text="Admin klub yang menyetujui. Selama menunggu, Anda bisa membatalkan permintaan.">
            <div className="flex items-center justify-between gap-2.5">
              <span>
                <b className="block">Klub Renang Tirta</b>
                <small className="text-muted-foreground">Dikirim 18 Okt 2026</small>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[13px] font-bold">
                <Hourglass className="size-3.5" aria-hidden />
                Menunggu
              </span>
            </div>
            <Row icon={UserCheck}>Admin klub memeriksa permintaan</Row>
          </Step>
          <Step className="lg:mt-[88px]" icon={BadgeCheck} title="Masuk sebagai anggota" text="Di klub yang mengaktifkan portal anggota, Anda bisa melihat data Anda dan melakukan booking.">
            <div className="flex items-center justify-between gap-2.5">
              <span>
                <b className="block">Klub Renang Tirta</b>
                <small className="text-muted-foreground">Anggota</small>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-[13px] font-bold text-primary-foreground">
                <Check className="size-3.5" aria-hidden />
                Disetujui
              </span>
            </div>
            <Row icon={Smartphone}>Portal anggota</Row>
            <Row icon={CalendarClock}>Booking jadwal dan fasilitas</Row>
          </Step>
        </ol>
        <p className="mt-8 flex items-center gap-2 text-[13px] text-muted-foreground lg:mt-[30px]">
          <b className="rounded-full bg-secondary px-2.5 py-0.5 text-[12.5px] font-bold text-foreground">Contoh data</b>
          Kode dan nama klub hanya ilustrasi.
        </p>
      </Wrap>
    </section>
  );
}
