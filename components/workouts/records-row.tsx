import { ShareCardButton } from "@/components/shared/share-card-button";

export interface RecordItem {
  key: string;
  sport: string;
  year: number;
  distance: string | null;
  duration: string | null;
  pace: string | null;
  cardHref: string;
  cardName: string;
}

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums">{value ?? "-"}</dd>
    </div>
  );
}

export function RecordsRow({ items, canShare }: { items: RecordItem[]; canShare: boolean }) {
  return (
    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <li key={item.key} className="w-64 shrink-0 snap-start">
          <article className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card p-4">
            <header className="flex items-baseline justify-between gap-2">
              <h3 className="truncate text-sm font-semibold">{item.sport}</h3>
              <span className="text-xs text-muted-foreground">{item.year}</span>
            </header>
            <dl className="flex-1">
              <Cell label="Jarak terjauh" value={item.distance} />
              <Cell label="Durasi terlama" value={item.duration} />
              <Cell label="Pace terbaik" value={item.pace} />
            </dl>
            {canShare ? (
              <div className="pt-1">
                <ShareCardButton href={item.cardHref} filename={item.cardName} />
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
