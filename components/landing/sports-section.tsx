import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PublicClubType } from "@/lib/club-type";
import { Wrap } from "./wrap";

export function SportsSection({ types }: { types: PublicClubType[] }) {
  const ready = types.filter((t) => t.status === "ready");
  if (ready.length === 0) return null;

  return (
    <section id="olahraga" aria-labelledby="olahraga-judul" className="scroll-mt-20 py-14 sm:py-[88px]">
      <Wrap>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-14">
          <h2 id="olahraga-judul" className="text-balance font-display text-[40px] uppercase leading-[0.98] sm:text-5xl lg:text-[64px]">
            Satu akun, {ready.length} olahraga.
          </h2>
          <p className="text-pretty text-lg text-muted-foreground sm:text-[19px]">
            Catat latihan apa pun di akun gratis Anda. Punya klub? Pilih olahraganya saat mendaftar, dan istilah, modul, serta saran fasilitas menyesuaikan.
          </p>
        </div>
        <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ready.map((t, i) => (
            <li key={t.code}>
              <Link
                href={`/s/${t.code}`}
                className="group flex h-full items-center gap-4 rounded-[20px] bg-card px-5 py-4 transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-primary-foreground hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
              >
                <span className="font-display text-2xl leading-none text-accent-foreground group-hover:text-primary-foreground" aria-hidden>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 font-bold leading-tight">{t.name}</span>
                <ArrowRight className="size-4 shrink-0 opacity-50 transition-[transform,opacity] group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-7 text-[15.5px] text-muted-foreground">
          Olahraga Anda belum ada?{" "}
          <Link href="/s" className="font-semibold text-foreground underline underline-offset-4 hover:text-accent-foreground">
            Lihat semua olahraga
          </Link>{" "}
          atau pilih Lainnya saat mendaftar.
        </p>
      </Wrap>
    </section>
  );
}
