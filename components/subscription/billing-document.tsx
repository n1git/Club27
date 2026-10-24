import type { Renewal, BillingParty } from "@/lib/billing/renewals";
import { formatJakartaDate, formatRupiahFull } from "@/lib/format";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PrintButton } from "@/components/subscription/print-button";
import { buttonVariants } from "@/components/ui/button";

const LONG = { day: "numeric", month: "long", year: "numeric" } as const;

function Party({ title, party }: { title?: string; party: BillingParty | null }) {
  if (!party) return null;
  return (
    <div className="flex flex-col text-sm leading-relaxed">
      {title ? <span className="font-semibold">{title}</span> : null}
      <span className={title ? "" : "font-semibold"}>{party.name}</span>
      {party.address ? <span className="whitespace-pre-line">{party.address}</span> : null}
      {party.email ? <span>{party.email}</span> : null}
      {party.website ? <span>{party.website}</span> : null}
    </div>
  );
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold">{label}</dt>
          <dd className={/^[A-Z]+-\d/.test(value) ? "font-mono" : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BillingDocument({ renewal, kind }: { renewal: Renewal; kind: "invoice" | "receipt" }) {
  const receipt = kind === "receipt";
  const total = formatRupiahFull(renewal.amount);
  const due = renewal.dueDate ? formatJakartaDate(renewal.dueDate, LONG) : null;
  const paid = renewal.paidAt ? formatJakartaDate(renewal.paidAt, LONG) : null;
  const meta: [string, string][] = receipt
    ? [
        ["Nomor invoice", renewal.invoiceNumber ?? "-"],
        ["Nomor kwitansi", renewal.receiptNumber ?? "-"],
        ["Tanggal bayar", paid ?? "-"],
      ]
    : [
        ["Nomor invoice", renewal.invoiceNumber ?? "-"],
        ["Tanggal terbit", renewal.invoiceDate ? formatJakartaDate(renewal.invoiceDate, LONG) : "-"],
        ["Jatuh tempo", due ?? "-"],
      ];
  const headline = receipt
    ? `${total} dibayar pada ${paid ?? "-"}`
    : renewal.status === "paid"
      ? `${total} lunas pada ${paid ?? "-"}`
      : renewal.status === "cancelled"
        ? `${total} · tagihan dibatalkan`
        : `${total} jatuh tempo ${due ?? "-"}`;
  const footer = receipt ? `${renewal.receiptNumber} · ${total} dibayar pada ${paid ?? "-"}` : `${renewal.invoiceNumber} · ${headline}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton />
        {!receipt && renewal.status === "pending" && renewal.paymentUrl ? (
          <a href={renewal.paymentUrl} className={buttonVariants({ variant: "outline" })}>
            Bayar sekarang
          </a>
        ) : null}
      </div>
      <article className="billing-doc mx-auto flex w-full max-w-[210mm] flex-col gap-8 rounded-lg border bg-card p-6 text-card-foreground sm:p-10">
        <header className="flex items-start justify-between gap-6">
          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">{receipt ? "Kwitansi" : "Invoice"}</h1>
            <Meta rows={meta} />
          </div>
          <BrandLogo className="h-8" />
        </header>

        <div className="grid gap-6 sm:grid-cols-2">
          <Party party={renewal.issuer} />
          <Party title="Ditagihkan kepada" party={renewal.billTo} />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xl font-bold">{headline}</p>
          {renewal.status === "cancelled" && !receipt ? (
            <p className="text-sm text-muted-foreground">Tagihan ini digantikan oleh pengajuan yang lebih baru dan tidak perlu dibayar.</p>
          ) : null}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 font-medium">Deskripsi</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Harga satuan</th>
              <th className="py-2 text-right font-medium">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {renewal.items.map((item, i) => (
              <tr key={i} className="border-b align-top">
                <td className="py-3">
                  {item.description}
                  {renewal.periodStart && renewal.periodEnd ? (
                    <div className="text-muted-foreground">
                      {formatJakartaDate(renewal.periodStart, LONG)} – {formatJakartaDate(renewal.periodEnd, LONG)}
                    </div>
                  ) : null}
                </td>
                <td className="py-3 text-right">{item.qty}</td>
                <td className="py-3 text-right">{formatRupiahFull(item.unit_price)}</td>
                <td className="py-3 text-right">{formatRupiahFull(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
          <dt>Subtotal</dt>
          <dd className="text-right">{total}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold">{total}</dd>
          <dt className="font-semibold">{receipt ? "Jumlah dibayar" : "Jumlah terutang"}</dt>
          <dd className="text-right font-semibold">{receipt || renewal.status === "pending" ? total : formatRupiahFull(0)}</dd>
        </dl>

        {receipt ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Riwayat pembayaran</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 font-medium">Metode pembayaran</th>
                  <th className="py-2 font-medium">Tanggal</th>
                  <th className="py-2 text-right font-medium">Jumlah dibayar</th>
                  <th className="py-2 text-right font-medium">Nomor kwitansi</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">{renewal.paymentMethod ?? (renewal.provider === "manual" ? "Transfer manual" : "Midtrans")}</td>
                  <td className="py-3">{paid ?? "-"}</td>
                  <td className="py-3 text-right">{total}</td>
                  <td className="py-3 text-right font-mono">{renewal.receiptNumber}</td>
                </tr>
              </tbody>
            </table>
          </section>
        ) : null}

        <footer className="flex flex-col gap-1 border-t pt-4 text-xs text-muted-foreground">
          {renewal.issuer?.footer ? <p>{renewal.issuer.footer}</p> : null}
          <p>{footer}</p>
        </footer>
      </article>
    </div>
  );
}
