import Link from "next/link";
import { Activity, Images } from "lucide-react";
import type { ProfileTile } from "@/lib/data/social";

function distance(m: number) {
  return m >= 1000 ? `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${m} m`;
}

export function PostGrid({ tiles, sportLabels }: { tiles: ProfileTile[]; sportLabels: Record<string, string> }) {
  if (tiles.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada postingan.</p>;
  return (
    <ul className="-mx-4 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1">
      {tiles.map((t) => {
        const sport = t.sport ? (sportLabels[t.sport] ?? t.sport) : null;
        const label = t.kind === "workout" ? `Latihan ${sport ?? ""}, ${t.durationMin} menit` : t.body ? `Postingan: ${t.body}` : "Postingan foto";
        return (
          <li key={t.id} className="relative aspect-square overflow-hidden bg-secondary sm:rounded-md">
            <Link href={`/p/${t.id}`} aria-label={label} className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              {t.photoUrl ? (
                <img src={t.photoUrl} alt="" loading="lazy" className="size-full object-cover" />
              ) : t.kind === "workout" ? (
                <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Activity size={16} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold leading-tight">{sport}</span>
                  <span className="text-[11px] leading-tight text-muted-foreground">
                    {t.durationMin} mnt{t.distanceM ? ` · ${distance(t.distanceM)}` : ""}
                  </span>
                </span>
              ) : (
                <span className="flex size-full items-center justify-center p-2.5">
                  <span className="line-clamp-5 break-words text-center text-xs leading-snug">{t.body}</span>
                </span>
              )}
            </Link>
            {t.photoCount > 1 ? <Images size={16} aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1.5 text-white drop-shadow" /> : null}
          </li>
        );
      })}
    </ul>
  );
}
