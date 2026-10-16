import Link from "next/link";
import { CircleDashed, CircleCheck } from "lucide-react";
import type { PublicClubType } from "@/lib/club-type";
import { describe } from "./sport-copy";
import { Section } from "./section";

export function SportsSection({ types, readyModules }: { types: PublicClubType[]; readyModules: string[] }) {
  const ready_ = new Set(readyModules);
  const ready = types.filter((t) => t.status === "ready");
  const soon = types.filter((t) => t.status === "soon");

  return (
    <Section
      id="olahraga"
      eyebrow="Olahraga"
      title="Satu inti aplikasi, disesuaikan dengan jenis klub Anda."
      intro="Jenis klub dipilih saat mendaftar. Istilah, modul, dan saran fasilitas mengikuti jenis klub tersebut."
    >
      {types.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-muted-foreground">
          Daftar jenis klub sedang tidak dapat dimuat. Silakan muat ulang halaman ini.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {ready.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Jenis klub yang tersedia">
              {ready.map((t) => (
                <li key={t.code} className="ui-transition relative flex items-start gap-3 rounded-lg border border-border bg-card p-5 hover:border-foreground/40">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden />
                  <div>
                    <p className="font-heading font-semibold">
                      <Link href={`/olahraga/${t.code}`} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:rounded-lg">
                        {t.name}
                      </Link>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{describe(t, ready_)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {soon.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Segera hadir</p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Jenis klub yang segera hadir">
                {soon.map((t) => (
                  <li
                    key={t.code}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
                  >
                    <CircleDashed className="size-4" aria-hidden />
                    {t.name}
                    <span className="sr-only">(segera hadir)</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}
