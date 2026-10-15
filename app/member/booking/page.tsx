import Link from "next/link";
import { requireMemberClub } from "@/lib/auth/guard";
import { getClubTerms } from "@/lib/club-type";
import { getAvailability, getMyBookings, getResources } from "@/lib/data/booking";
import { addDays } from "@/lib/booking-grid";
import { BOOKING_STATUS_LABEL } from "@/lib/booking";
import { bookResourceAsMember, cancelBooking } from "@/lib/actions/booking";
import { formatJakartaDate, formatJakartaTime, getJakartaDateString } from "@/lib/format";
import { ActionForm } from "@/components/shared/action-form";
import { ActionSubmitButton } from "@/components/shared/action-submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { RefreshOnFocus } from "@/components/shared/refresh-on-focus";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function MemberBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ fasilitas?: string; tanggal?: string }>;
}) {
  await requireMemberClub();
  const sp = await searchParams;
  const today = getJakartaDateString();
  const [terms, resources, mine] = await Promise.all([getClubTerms(), getResources({ activeOnly: true }), getMyBookings()]);
  const chosen = resources.find((r) => r.id === sp.fasilitas) ?? resources[0];
  const maxDate = chosen ? addDays(today, chosen.advanceDays) : today;
  const requested = sp.tanggal && DATE_RE.test(sp.tanggal) ? sp.tanggal : today;
  const date = requested < today ? today : requested > maxDate ? maxDate : requested;
  const slots = chosen ? await getAvailability(chosen.id, date) : [];
  const now = new Date().getTime();

  const upcoming = mine.filter((b) => b.status === "confirmed" && new Date(b.endTime).getTime() > now).reverse();
  const history = mine.filter((b) => !(b.status === "confirmed" && new Date(b.endTime).getTime() > now)).slice(0, 10);
  const hm = (v: string) => formatJakartaTime(v, { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  const link = (f: string, d: string) => `/member/booking?fasilitas=${f}&tanggal=${d}`;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <RefreshOnFocus />
      <PageHeader title={<>Booking</>} subtitle={<>Pilih {terms.resource.toLowerCase()}, tanggal, lalu slot. Waktu dalam WIB.</>} />

      {resources.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          Belum ada {terms.resource.toLowerCase()} yang bisa dibooking di klub ini.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Booking baru</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label={terms.resource}>
              {resources.map((r) => (
                <Link
                  key={r.id}
                  href={link(r.id, date)}
                  aria-current={r.id === chosen?.id ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 items-center rounded-md border px-3 text-sm font-medium",
                    r.id === chosen?.id ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"
                  )}
                >
                  {r.name}
                </Link>
              ))}
            </div>
            {chosen ? (
              <>
                <form method="get" action="/member/booking" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="fasilitas" value={chosen.id} />
                  <div className="flex flex-col gap-1">
                    <label htmlFor="mb-date" className="text-xs text-muted-foreground">
                      Tanggal
                    </label>
                    <Input id="mb-date" name="tanggal" type="date" min={today} max={maxDate} defaultValue={date} className="h-10 w-44" />
                  </div>
                  <button type="submit" className={cn(buttonVariants({ variant: "secondary" }), "h-10")}>
                    Lihat
                  </button>
                </form>
                <p className="text-xs text-muted-foreground">
                  {chosen.locationName} · slot {chosen.slotMinutes} menit
                  {chosen.pricePerSlot > 0 ? ` · Rp ${chosen.pricePerSlot.toLocaleString("id-ID")} per slot` : ""} · bisa dibatalkan sampai {chosen.cancelHours} jam
                  sebelum mulai
                </p>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Tutup pada tanggal ini.</p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {slots.map((s) => (
                      <li key={s.start}>
                        {s.bookable ? (
                          <ActionForm action={bookResourceAsMember}>
                            <input type="hidden" name="resourceId" value={chosen.id} />
                            <input type="hidden" name="start" value={s.start} />
                            <input type="hidden" name="end" value={s.end} />
                            <ActionSubmitButton
                              variant="outline"
                              confirmMessage={`Booking ${chosen.name} pukul ${hm(s.start)}?`}
                              className="h-auto min-h-[52px] w-full flex-col items-start gap-0 px-3 py-1.5"
                            >
                              <span className="text-sm tabular-nums">
                                {hm(s.start)}–{hm(s.end)}
                              </span>
                              <span className="text-xs text-muted-foreground">{chosen.capacity > 1 ? `${s.remaining} tempat tersisa` : "Tersedia"}</span>
                            </ActionSubmitButton>
                          </ActionForm>
                        ) : (
                          <div
                            className={cn(
                              "flex min-h-[52px] flex-col justify-center rounded-md border px-3 py-1.5",
                              s.mine ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40 text-muted-foreground"
                            )}
                          >
                            <span className="text-sm tabular-nums">
                              {hm(s.start)}–{hm(s.end)}
                            </span>
                            <span className="text-xs">{s.mine ? "Booking saya" : s.remaining === 0 ? "Penuh" : "Tidak tersedia"}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Booking saya</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {upcoming.length === 0 && history.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada booking.</p> : null}
          {upcoming.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {upcoming.map((b) => {
                const canCancel = new Date(b.startTime).getTime() - b.cancelHours * 3_600_000 > now;
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{b.resourceName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatJakartaDate(b.startTime, { weekday: "short", day: "numeric", month: "short" })},{" "}
                        {hm(b.startTime)}–{hm(b.endTime)} · {b.locationName}
                      </p>
                    </div>
                    {canCancel ? (
                      <ActionForm action={cancelBooking}>
                        <input type="hidden" name="bookingId" value={b.id} />
                        <ActionSubmitButton variant="outline" size="sm" className="h-9" confirmMessage="Batalkan booking ini?">
                          Batalkan
                        </ActionSubmitButton>
                      </ActionForm>
                    ) : (
                      <span className="text-xs text-muted-foreground">Tidak bisa dibatalkan (kurang dari {b.cancelHours} jam)</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {history.length > 0 ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">Riwayat</h3>
              <ul className="flex flex-col gap-1.5">
                {history.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {b.resourceName} · {formatJakartaDate(b.startTime, { day: "numeric", month: "short" })},{" "}
                      {hm(b.startTime)}
                    </span>
                    <Badge variant={b.status === "cancelled" || b.status === "no_show" ? "warning" : "secondary"}>
                      {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export const unstable_dynamicStaleTime = 0;
