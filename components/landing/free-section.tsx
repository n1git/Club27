import { Activity, BadgeCheck, Ban, CalendarCheck, Download, Lock, TicketCheck, Trophy, UserPlus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wrap } from "./wrap";

const WEEKS = [
  { n: 2, h: 42, label: "3 mgg lalu" },
  { n: 4, h: 100, label: "2 mgg lalu" },
  { n: 3, h: 62, label: "Minggu lalu" },
  { n: 3, h: 62, label: "Minggu ini" },
];

const ALSO = [
  { icon: BadgeCheck, label: "Profil dan username unik" },
  { icon: Trophy, label: "Peringkat grup dan klub" },
  { icon: Ban, label: "Blokir dan laporkan konten" },
  { icon: Download, label: "Ekspor data akun" },
  { icon: UserRound, label: "Hapus akun sendiri" },
];

function TileHead({ icon: Icon, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-[18px] grid size-[46px] place-items-center rounded-[14px] bg-foreground text-primary dark:bg-primary dark:text-primary-foreground">
        <Icon className="size-5" strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="text-[25px] font-bold leading-[1.15]">{title}</h3>
      <p className="mt-2 max-w-[44ch] text-muted-foreground">{children}</p>
    </div>
  );
}

function Pill({ icon: Icon, dark, children }: { icon?: typeof Lock; dark?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] font-bold", dark ? "bg-foreground text-background" : "bg-card")}>
      {Icon ? <Icon className="size-5" strokeWidth={1.75} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function FreeSection() {
  return (
    <section id="gratis" aria-labelledby="gratis-judul" className="scroll-mt-20 py-14 sm:py-[88px]">
      <Wrap>
        <h2 id="gratis-judul" className="max-w-[21ch] text-balance font-display text-[40px] uppercase leading-[0.98] sm:text-5xl lg:text-[64px]">
          Gratis untuk siapa saja, bukan masa percobaan.
        </h2>
        <p className="mt-4 max-w-[52ch] text-pretty text-lg text-muted-foreground sm:text-[19px]">
          Daftar di satu halaman. Tidak perlu organisasi, tidak perlu kartu.
        </p>
        <div className="mt-12 grid gap-5 md:grid-cols-[7fr_5fr]">
          <article className="flex flex-col justify-between gap-7 rounded-[28px] bg-card p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none sm:p-8 md:row-span-2">
            <TileHead icon={Activity} title="Catat latihan dan pantau minggu Anda">
              Pasang target mingguan, lalu lihat ringkasan 4 minggu terakhir. Catatan latihan bersifat pribadi.
            </TileHead>
            <div>
              <div className="flex h-40 items-end gap-2.5 sm:h-[210px] sm:gap-[18px]" role="img" aria-label="Contoh ringkasan 4 minggu: 2, 4, 3, dan 3 sesi">
                {WEEKS.map((w, i) => (
                  <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2 text-sm font-semibold text-muted-foreground">
                    <b className="font-display text-[30px] leading-none text-foreground">{w.n}</b>
                    <i className={cn("block w-full rounded-t-[18px] rounded-b-lg", i === WEEKS.length - 1 ? "bg-primary" : "bg-secondary")} style={{ height: `${w.h}%` }} />
                    {w.label}
                  </div>
                ))}
              </div>
              <p className="mt-7">
                <b className="rounded-full bg-secondary px-2.5 py-0.5 text-[12.5px] font-bold text-foreground">Contoh data</b>
              </p>
            </div>
          </article>
          <article className="rounded-[28px] bg-primary/30 p-6 dark:bg-primary/15 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none sm:p-8">
            <TileHead icon={UserPlus} title="Teman dan feed khusus teman">
              Cari teman dengan username persis. Posting, beri kudos, komentari, atau bagikan latihan ke feed.
            </TileHead>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full bg-card py-2 pl-2 pr-4 text-[15px] font-bold">
                <span className="grid size-[22px] place-items-center rounded-full bg-foreground text-[9px] text-primary dark:bg-primary dark:text-primary-foreground">DP</span>@dimasp
              </span>
              <Pill dark icon={UserPlus}>
                Tambah teman
              </Pill>
            </div>
          </article>
          <article className="rounded-[28px] bg-secondary p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl motion-reduce:transition-none sm:p-8">
            <TileHead icon={CalendarCheck} title="Grup privat dengan event">
              Buat grup, jadwalkan event, dan buka RSVP dengan kuota kursi.
            </TileHead>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Pill icon={Lock}>Lari Subuh</Pill>
              <Pill icon={TicketCheck}>14 dari 20 kursi</Pill>
            </div>
          </article>
        </div>
        <ul className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-2.5">
          {ALSO.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-2 font-semibold">
              <Icon className="size-5 text-accent-foreground" strokeWidth={1.75} aria-hidden />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[15.5px] text-muted-foreground">
          <b className="text-foreground">Belum ada:</b> feed publik, chat, notifikasi kudos dan komentar, aplikasi mobile.
        </p>
      </Wrap>
    </section>
  );
}
