import Link from "next/link";
import { requireRole } from "@/lib/auth/guard";
import { getClubTerms } from "@/lib/club-type";
import { getAllResourceHours, getBookingsInRange, getResources } from "@/lib/data/booking";
import { addDays, buildCells, mondayOf, type GridColumn } from "@/lib/booking-grid";
import { getJakartaDateString } from "@/lib/format";
import { BookingCalendar } from "@/components/booking/booking-calendar";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("id-ID", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string; tampilan?: string; fasilitas?: string }>;
}) {
  await requireRole(["admin", "receptionist"]);
  const sp = await searchParams;
  const today = getJakartaDateString();
  const date = sp.tanggal && DATE_RE.test(sp.tanggal) && !Number.isNaN(Date.parse(sp.tanggal)) ? sp.tanggal : today;
  const week = sp.tampilan === "minggu";

  const [terms, resources, hours] = await Promise.all([
    getClubTerms(),
    getResources({ activeOnly: true }),
    getAllResourceHours(),
  ]);

  const chosen = resources.find((r) => r.id === sp.fasilitas) ?? resources[0];
  const days = week ? Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date), i)) : [date];
  const rangeStart = new Date(`${days[0]}T00:00:00+07:00`).toISOString();
  const rangeEnd = new Date(`${addDays(days[days.length - 1], 1)}T00:00:00+07:00`).toISOString();
  const shown = week ? (chosen ? [chosen] : []) : resources;
  const bookings = shown.length ? await getBookingsInRange(rangeStart, rangeEnd, shown.map((r) => r.id)) : [];

  const columns: GridColumn[] = week
    ? days.map((d) => ({
        key: d,
        title: formatDay(d),
        subtitle: chosen?.name ?? "",
        resource: chosen!,
        cells: chosen ? buildCells(d, chosen, hours[chosen.id] ?? [], bookings) : [],
      }))
    : resources.map((r) => ({
        key: r.id,
        title: r.name,
        subtitle: r.locationName,
        resource: r,
        cells: buildCells(date, r, hours[r.id] ?? [], bookings),
      }));

  const step = week ? 7 : 1;
  const query = (d: string, view = week, f = chosen?.id) =>
    `/admin/booking?tanggal=${d}${view ? "&tampilan=minggu" : ""}${f ? `&fasilitas=${f}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={<>Booking</>} subtitle={<>
          Pilih slot untuk membuat booking atau mengelola yang sudah ada. Waktu dalam WIB.
        </>} />

      {resources.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-6">
          <p className="text-sm text-muted-foreground">Belum ada {terms.resource.toLowerCase()} yang aktif.</p>
          <Link href="/admin/fasilitas" className={buttonVariants({ size: "sm" })}>
            Tambah {terms.resource}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="inline-flex rounded-md border border-input p-0.5" role="group" aria-label="Tampilan">
              {[
                { label: "Hari", on: !week, href: query(date, false) },
                { label: "Minggu", on: week, href: query(date, true) },
              ].map((v) => (
                <Link
                  key={v.label}
                  href={v.href}
                  aria-current={v.on ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded px-3 text-sm font-medium",
                    v.on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {v.label}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <Link href={query(addDays(date, -step))} className={cn(buttonVariants({ variant: "outline" }), "h-10")} aria-label="Sebelumnya">
                ‹
              </Link>
              <Link href={query(today)} className={cn(buttonVariants({ variant: "outline" }), "h-10")}>
                Hari ini
              </Link>
              <Link href={query(addDays(date, step))} className={cn(buttonVariants({ variant: "outline" }), "h-10")} aria-label="Berikutnya">
                ›
              </Link>
            </div>
            <form method="get" action="/admin/booking" className="flex flex-wrap items-end gap-2">
              {week ? <input type="hidden" name="tampilan" value="minggu" /> : null}
              {week && chosen ? (
                <div className="flex flex-col gap-1">
                  <label htmlFor="bk-res" className="text-xs text-muted-foreground">
                    {terms.resource}
                  </label>
                  <Select id="bk-res" name="fasilitas" defaultValue={chosen.id} className="h-10 w-44">
                    {resources.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <label htmlFor="bk-date" className="text-xs text-muted-foreground">
                  Tanggal
                </label>
                <Input id="bk-date" name="tanggal" type="date" defaultValue={date} className="h-10 w-40" />
              </div>
              <button type="submit" className={cn(buttonVariants({ variant: "secondary" }), "h-10")}>
                Lihat
              </button>
            </form>
          </div>
          <p className="text-sm font-medium">
            {week
              ? `${formatDay(days[0])} – ${formatDay(days[6])}`
              : formatDay(date)}
          </p>
          <BookingCalendar columns={columns} nowIso={new Date().toISOString()} emptyText="Tutup" />
        </>
      )}
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
