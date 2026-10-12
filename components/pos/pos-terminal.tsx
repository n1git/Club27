"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createOrder } from "@/lib/actions/orders";
import { PAYMENT_METHODS, type Product, type UnpaidBooking } from "@/lib/commerce";
import { formatJakartaDate, formatJakartaTime, formatRupiahFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MemberPicker } from "@/components/shared/member-picker";

interface Line {
  key: string;
  kind: "product" | "booking";
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
  max: number | null;
}

interface PayRow {
  key: number;
  method: string;
  amount: string;
  reference: string;
}

const hm = (v: string) => formatJakartaTime(v, { hour: "2-digit", minute: "2-digit" }).replace(".", ":");

export function PosTerminal({
  products,
  bookings,
}: {
  products: Product[];
  bookings: UnpaidBooking[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requestId] = useState(() => crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [memberId, setMemberId] = useState("");
  const [customer, setCustomer] = useState("");
  const [pays, setPays] = useState<PayRow[]>([{ key: 1, method: "cash", amount: "", reference: "" }]);
  const [error, setError] = useState("");

  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter((c): c is string => Boolean(c)))].sort(), [products]);
  const shown = products.filter(
    (p) =>
      (!category || p.category === category) &&
      (!query || p.name.toLowerCase().includes(query.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(query.toLowerCase()))
  );
  const shownBookings = bookings.filter((b) => (memberId ? b.memberId === memberId || b.memberId === null : true));
  const total = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const paid = pays.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = total - paid;
  const count = lines.reduce((s, l) => s + l.qty, 0);

  function addProduct(p: Product) {
    setLines((cur) => {
      const found = cur.find((l) => l.key === `p-${p.id}`);
      const max = p.trackStock ? p.stockQty : null;
      if (found) {
        if (max !== null && found.qty >= max) return cur;
        return cur.map((l) => (l === found ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...cur, { key: `p-${p.id}`, kind: "product", id: p.id, name: p.name, unitPrice: p.price, qty: 1, max }];
    });
  }

  function addBooking(b: UnpaidBooking) {
    if (lines.some((l) => l.key === `b-${b.id}`)) return;
    if (b.memberId && !memberId) setMemberId(b.memberId);
    setLines((cur) => [
      ...cur,
      {
        key: `b-${b.id}`,
        kind: "booking",
        id: b.id,
        name: `${b.resourceName} · ${formatJakartaDate(b.startTime, { day: "numeric", month: "short" })} ${hm(b.startTime)}`,
        unitPrice: b.price,
        qty: 1,
        max: 1,
      },
    ]);
  }

  function changeQty(key: string, delta: number) {
    setLines((cur) =>
      cur
        .map((l) => (l.key === key ? { ...l, qty: Math.min(l.max ?? 9999, l.qty + delta) } : l))
        .filter((l) => l.qty > 0)
    );
  }

  function updatePay(key: number, patch: Partial<PayRow>) {
    setPays((cur) => cur.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function fillRemaining(key: number) {
    const others = pays.filter((p) => p.key !== key).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    updatePay(key, { amount: String(Math.max(total - others, 0)) });
  }

  const usedPays = pays.filter((p) => Number(p.amount) > 0);
  const over = paid > total;
  const label = lines.length === 0 ? "Pilih item dulu" : total === 0 ? "Selesaikan" : remaining === 0 ? "Bayar & selesaikan" : paid > 0 ? "Simpan, belum lunas" : "Simpan tanpa pembayaran";

  function submit() {
    setError("");
    const payload = {
      requestId,
      memberId: memberId || null,
      customerName: customer.trim() || null,
      items: lines.map((l) => (l.kind === "product" ? { kind: "product", productId: l.id, qty: l.qty } : { kind: "booking", bookingId: l.id })),
      payments: usedPays.map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference.trim() || undefined })),
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    startTransition(async () => {
      const r = await createOrder({}, fd);
      if (r.ok && r.orderId) {
        toast.success(r.message ?? "Pesanan tersimpan");
        router.push(`/admin/pesanan/${r.orderId}`);
      } else {
        setError(r.error ?? "Gagal menyimpan pesanan");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari produk atau SKU"
            aria-label="Cari produk"
            className="h-10 min-w-0 flex-1 sm:max-w-xs"
          />
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategori">
              {["", ...categories].map((c) => (
                <button
                  key={c || "semua"}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "h-10 rounded-md border px-3 text-sm font-medium",
                    category === c ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"
                  )}
                >
                  {c || "Semua"}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {products.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Belum ada produk aktif. Tambahkan di menu Produk, atau jual booking di bawah.
          </p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada produk yang cocok.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((p) => {
              const out = p.trackStock && p.stockQty === 0;
              const inCart = lines.find((l) => l.key === `p-${p.id}`)?.qty ?? 0;
              const atMax = p.trackStock && inCart >= p.stockQty;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={out || atMax}
                    onClick={() => addProduct(p)}
                    className="flex min-h-[76px] w-full flex-col items-start justify-between rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap tabular-nums text-foreground">{formatRupiahFull(p.price)}</span>
                      <span>{out ? "Habis" : inCart > 0 ? `${inCart} di keranjang` : p.trackStock ? `Stok ${p.stockQty}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <section aria-labelledby="pos-bookings" className="flex flex-col gap-2">
          <h2 id="pos-bookings" className="text-sm font-semibold">
            Booking belum dibayar
          </h2>
          {shownBookings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada booking berbayar yang menunggu pembayaran.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shownBookings.map((b) => {
                const added = lines.some((l) => l.key === `b-${b.id}`);
                return (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {b.resourceName} · {formatJakartaDate(b.startTime, { weekday: "short", day: "numeric", month: "short" })}, {hm(b.startTime)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.memberName ?? b.guestName ?? "Tamu"} · {formatRupiahFull(b.price)}
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-10" disabled={added} onClick={() => addBooking(b)}>
                      {added ? "Di keranjang" : "Tambah"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside id="keranjang" className="flex h-fit flex-col gap-4 rounded-lg border border-border bg-card p-4 lg:sticky lg:top-4" aria-label="Keranjang">
        <h2 className="text-base font-semibold">Keranjang</h2>
        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-member">Anggota (opsional)</Label>
            <MemberPicker
              id="pos-member"
              value={memberId}
              valueLabel={bookings.find((b) => b.memberId === memberId)?.memberName}
              onChange={setMemberId}
              emptyLabel="Tanpa anggota"
            />
          </div>
          {memberId ? null : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-customer">Nama pelanggan (opsional)</Label>
              <Input id="pos-customer" value={customer} onChange={(e) => setCustomer(e.target.value)} className="h-10" maxLength={120} />
            </div>
          )}
        </div>

        {lines.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Keranjang kosong. Pilih produk atau booking.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lines.map((l) => (
              <li key={l.key} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatRupiahFull(l.unitPrice)}</p>
                </div>
                <div className="flex items-center gap-1">
                  {l.kind === "product" ? (
                    <>
                      <Button type="button" size="icon" variant="outline" className="size-10" aria-label={`Kurangi ${l.name}`} onClick={() => changeQty(l.key, -1)}>
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-6 text-center text-sm tabular-nums">{l.qty}</span>
                      <Button type="button" size="icon" variant="outline" className="size-10" aria-label={`Tambah ${l.name}`} disabled={l.max !== null && l.qty >= l.max} onClick={() => changeQty(l.key, 1)}>
                        <Plus className="size-4" />
                      </Button>
                    </>
                  ) : (
                    <Button type="button" size="icon" variant="ghost" className="size-10" aria-label={`Hapus ${l.name}`} onClick={() => changeQty(l.key, -1)}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatRupiahFull(total)}</span>
        </div>

        {total > 0 ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Pembayaran</h3>
            {pays.map((p, i) => (
              <div key={p.key} className="flex flex-col gap-2 rounded-md border border-border p-2">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Select aria-label={`Metode pembayaran ${i + 1}`} value={p.method} onChange={(e) => updatePay(p.key, { method: e.target.value })} className="h-10">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  {pays.length > 1 ? (
                    <Button type="button" size="icon" variant="ghost" className="size-10" aria-label={`Hapus pembayaran ${i + 1}`} onClick={() => setPays((c) => c.filter((x) => x.key !== p.key))}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    aria-label={`Jumlah pembayaran ${i + 1}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="Jumlah (Rp)"
                    value={p.amount}
                    onChange={(e) => updatePay(p.key, { amount: e.target.value })}
                    className="h-10"
                  />
                  <Button type="button" variant="outline" className="h-10" onClick={() => fillRemaining(p.key)}>
                    Pas
                  </Button>
                </div>
                {p.method !== "cash" ? (
                  <Input aria-label={`Referensi pembayaran ${i + 1}`} placeholder="Referensi (opsional)" value={p.reference} onChange={(e) => updatePay(p.key, { reference: e.target.value })} className="h-10" maxLength={120} />
                ) : null}
              </div>
            ))}
            {pays.length < 5 ? (
              <Button type="button" variant="ghost" className="h-10 w-fit" onClick={() => setPays((c) => [...c, { key: Math.max(...c.map((x) => x.key)) + 1, method: "transfer", amount: "", reference: "" }])}>
                + Pembayaran lain
              </Button>
            ) : null}
            <p className={cn("text-sm tabular-nums", over ? "text-destructive" : "text-muted-foreground")} role={over ? "alert" : undefined}>
              {over ? `Pembayaran melebihi total sebesar ${formatRupiahFull(paid - total)}` : `Sisa: ${formatRupiahFull(remaining)}`}
            </p>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="button" className="h-11" disabled={pending || lines.length === 0 || over} onClick={submit}>
          {pending ? "Memproses..." : label}
        </Button>
      </aside>

      {count > 0 ? (
        <a
          href="#keranjang"
          className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+0.5rem)] z-10 sm:bottom-4 flex h-12 items-center justify-between rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-lg lg:hidden"
        >
          <span>{count} item</span>
          <span className="tabular-nums">{formatRupiahFull(total)} · Lihat keranjang</span>
        </a>
      ) : null}
    </div>
  );
}
