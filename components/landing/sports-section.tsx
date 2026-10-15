import { CircleDashed, CircleCheck } from "lucide-react";
import type { PublicClubType } from "@/lib/club-type";
import { Section } from "./section";

function describe(t: PublicClubType, ready: Set<string>): string {
  const has = (code: string) => t.modules.includes(code) && ready.has(code);
  const parts = [`${t.terms.member} dan ${t.terms.coach.toLowerCase()}`];
  if (has("classes")) parts.push(`jadwal ${t.terms.session.toLowerCase()}`);
  if (has("resource_booking")) parts.push(`booking ${t.terms.resource.toLowerCase()}`);
  if (has("checkin")) parts.push("check-in QR");
  if (has("pos")) parts.push("kasir");
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, dan ${parts[parts.length - 1]}` : parts[0];
}

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
                <li key={t.code} className="flex items-start gap-3 rounded-lg border border-border bg-card p-5">
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-accent-foreground" aria-hidden />
                  <div>
                    <p className="font-heading font-semibold">{t.name}</p>
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
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground"
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
