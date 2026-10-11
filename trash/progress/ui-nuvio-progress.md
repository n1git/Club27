# ui-nuvio progress

Restyle of the signed-in app to the framed, hatched card structure. Colors and fonts unchanged; UI only.

## Status

- [x] Phase 0: preparation
- [x] Phase 1: tokens and primitives
- [ ] Phase 2: shell
- [ ] Phase 3: pages
- [ ] Phase 4: sweep and final checks

## Phase 0 result

- Pages by layout pattern:
  - Dashboard: `/admin`, `/coach`, `/member`, `/superadmin` (portal home), `/admin/reports`, `/admin/checkin`, `/admin/klub`, `/admin/klub/langganan`.
  - List (header, filters, table or card grid): members, coaches, staff, schedule, booking, fasilitas, kasir (terminal), pesanan, produk, billing packages, subscriptions, invoices, cash ledger, payroll, promo, audit, `/coach/schedule`, `/coach/members`, `/member/pesanan`, `/member/kunjungan`.
  - Detail: members `[id]`, coaches `[id]`, pesanan `[id]`, coach attendance, klub pages.
  - Form: members `new`, coaches `new`, schedule `new`, settings, settings/modul, onboarding, member booking.
- Approach: `Card` itself becomes the framed card (hatch frame, header row on the hatch, inner body), so every page built from `Card`, `CardHeader`, `CardContent` inherits it. `frame={false}` keeps the old flat card for the landing preview and the auth pages. Control sizes (button, input, select, textarea, label, badge) change only inside `.app-ui`, the class set on the app shell root, so the landing and auth pages keep their sizes. Breadcrumbs derive from the grouped navigation (group label, then item label) through a context provider; no new copy.
- Dashboards: no queries are added, so the layout uses the data the pages already load; sparklines and deltas are supported by `MetricCard` but only rendered where a series already exists.

## Phase 1 done

- Tokens added only: `--frame`, `--stripe` (color-mix of existing tokens, so light and dark follow the existing values), `--radius-inner`, `--radius-frame`, easing and four durations that become 0 ms under reduced motion; `.hatch` and `.ui-transition` utilities. No existing token or font setup changed.
- `Card` (framed), `Table` (tabular numbers, lighter header), `Dialog` and `TriggerDialog` (framed), `Button`, `Input`, `Select`, `Textarea`, `Label`, `Badge` restyled; app controls are 44 px high with 16 px text on phones and 32 px with 12 px text from `sm` up.
- New: `FramedCard`, `MetricCard` (replaces `StatCard`, optional delta with text and optional sparkline), `PageHeader` with `Breadcrumb`, `NavGroupsProvider`.

## Phase 2 done

- Shell: the sidebar now runs full height with a 54 px brand row (small logo tile, brand name, dashed bottom border), captions, 34 px rows and a soft border and shadow on the active row (sidebar colors unchanged); the header sits beside it with the same 54 px height and a dashed bottom border, and keeps the club name, role chip, tenant and club switchers, theme toggle, password and sign-out controls in the same order. Bottom bar gets a dashed top border and transitions on the shared motion tokens; the menu sheet's group containers use the frame radius. Switchers inherit the new control sizes through `Select`.

## Phase 3 done

- `PageHeader` with the automatic breadcrumb replaces the heading block on all 39 signed-in pages that had one (admin, coach, member, superadmin portal), keeping titles, subtitles and actions as they were.
- Admin dashboard: metric cards in one grid (the booking and sales cards join it only when their module is on), "Kelas Hari Ini" at two thirds beside "Transaksi Kas Terbaru" at one third, then the overdue invoices and expiring subscriptions tables full width, then quick actions. No queries added, so there is no chart or sparkline on the dashboard.
- Reports charts: rounded bar tops, horizontal gridlines only, dashed reference line (average for programs, zero for cash flow), tooltip with a highlighted band and a darker hovered bar, total above the plot, and a visually hidden table per chart as the text alternative. The cash flow chart now shows monthly in and out as bars; the net total sits above the plot.
- Tables: `Table` now draws its own hatch frame and inner surface and drops them when it sits inside a card, so every table inherits the look; on members, coaches, schedule, subscriptions and invoices the existing search and filters moved into the framed card header.

## Phase 4 done

- Leftovers: the old stat card file is gone; `Card` keeps a flat variant (`frame={false}`) only for the landing preview and the auth pages. README (page layout section, changelog 2026-10-10) and `CLAUDE.md` notes updated.
- Checks: `npm run build`, `npx tsc --noEmit` and `npm run lint` pass. The diff of `app/globals.css` since the start of this task contains only additions (no removed or edited color token); `app/layout.tsx` and the font setup are untouched.
- Contrast: the muted text on the hatch measured 4.29:1 in light at the stripe pixel with the first values, so the stripe was lightened and header titles and descriptions inside frames use a muted-to-foreground mix: 5.8:1 on the stripe in light and 7.3:1 in dark. axe found no issues on the 8 checked pages in light and dark at 1440 and 375 px.
- Local run on the demo seed (PostgREST, built app, Chromium): screenshots at 1440 and 375 px in both themes of dashboard, members list, schedule, kasir, a form (new member), reports, a coach page and the member page were taken and reviewed. No horizontal scroll at 375 px on any of them (one case from the hidden chart table was fixed); application controls on members and reports are at least 44 px high on phones; focus ring visible on inputs; print media hides the sidebar and header and the receipt renders flat without hatch.
- Not re-tested after the restyle: keyboard behavior of the menu sheet, dialogs and tables was not re-run, only unchanged markup and focus rings (tables keep their focusable scroll wrapper).
