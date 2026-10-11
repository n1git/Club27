# grouped-nav progress

Grouped sidebar and mobile bottom bar with a full-screen menu sheet. UI only.

## Status

- [x] Phase 0: preparation and plan
- [x] Phase 1: shell
- [x] Phase 2: wiring and final checks

## Assessment

- `AppShell` takes a flat `navItems`; the three callers are `app/admin/layout.tsx`, `app/coach/layout.tsx`, `app/member/layout.tsx`. `NavLink` is a client component with the `exact` rule (default exact only for one-segment hrefs). Header, `tenantSwitcher`, `print:hidden` stay as they are.
- Tokens exist for light and dark (`--sidebar*`, `--background`, `--card`, `--muted-foreground`, `--border`); no new colors needed.
- Root layout has no `viewport` export, so `env(safe-area-inset-bottom)` is zero on iOS. Assumption: add `viewportFit: "cover"` to the root layout, the smallest change that makes decision 8 true.
- The cashier's floating cart bar (`fixed bottom-4`) would sit under the new bottom bar on phones; it is moved above the bar below `sm`.
- `dialog.tsx` is route-bound; the sheet is a plain native `<dialog>` instead (Escape and focus return come from the browser).

## Assumptions

1. Mobile bar: if all items are at most 5, show all of them and no "Menu" tab (coach, member); otherwise the items marked `primary` (cap 4) plus "Menu". Admin 5 tabs at most. A member with 5 items thus shows all five.
2. `primary` is decided in the layout after filtering, so a receptionist (no Dasbor) simply gets fewer primary items.
3. Owner group "Organisasi" is shown only to the owner, as today; the owner's own club items follow the same filters.
4. "Langganan" appears twice for the owner (organization, and the club billing item); both stay, each under its own group, as today.

## Group map

- Admin (owner): Organisasi (Klub, Langganan); Utama (Dasbor); Orang (Anggota, Pelatih, Staf); Operasional (Jadwal, Booking, {terms.resource}, Check-in); Penjualan (Kasir, Pesanan, Produk); Keuangan (Paket, Langganan, Tagihan, Buku Kas, Gaji Pelatih); Lainnya (Promo, Laporan, Pengaturan). Each item subject to the existing module filter; owner skips the role filter as today.
- Admin (non-owner admin): same without Organisasi.
- Receptionist: Orang (Anggota), Operasional (Jadwal, Booking, Check-in if module), Penjualan (Kasir, Pesanan), Keuangan (Tagihan). Finance: Penjualan (Pesanan), Keuangan (Tagihan, Buku Kas... per `canAccessPath`), Lainnya (Laporan). Final lists are whatever `canAccessPath` allows; empty groups vanish.
- Coach: one unlabeled group (Jadwal Saya). Head coach adds Semua Jadwal, Semua Anggota. Member: one unlabeled group (Beranda, Booking, Pesanan, Kunjungan, Klub Saya, or Pilih Klub when pending).

## Phase 1 done

- New `components/shared/`: `nav-types.ts` (`NavItem`, `NavGroup`, icon keys, shared active rule), `nav-icon.tsx` (key to `lucide-react`, one size and stroke), `nav-link.tsx` (icon row, `aria-current`), `sidebar-nav.tsx` (dark sidebar, labelled groups, a subtle container per group), `mobile-nav.tsx` (bottom tab bar with safe-area padding, 56 px targets, and a native-`<dialog>` full-screen "Menu" sheet with light background, white rounded group containers, dividers, arrows; closes on navigation, Escape, or the close button, and returns focus to "Menu"). `AppShell` takes `navGroups`; header unchanged. Root layout exports `viewportFit: "cover"`; `main` gets bottom padding on mobile; the cashier's floating cart bar sits above the bottom bar on phones.
- Callers are rewired in Phase 2.

## Phase 2 done

- Admin layout builds the seven groups (Organisasi for the owner only) with the existing module and `canAccessPath` filters; the first two visible of Jadwal, Booking, Kasir, Check-in plus Dasbor and Anggota are `primary`. Coach and member layouts use one unlabeled group. The bottom bar pads to three tabs when fewer items are `primary` (finance), added after testing. Facility icon changed to avoid looking like Dasbor. README (navigation section, changelog) and `CLAUDE.md` updated.
- Passed: `npm run build`, `npx tsc --noEmit`, `npm run lint`. Every href in the groups is an existing route (unchanged list).
- Verified in a real browser (local PostgREST + built app + Chromium) with owner, receptionist, finance, coach, head coach and member: only permitted items per role, empty groups gone, disabling `pos` removed the Penjualan group; `/admin/members/<id>` highlights only Anggota, `/admin/klub/langganan` only Langganan under Organisasi, `/admin/billing/subscriptions` only Langganan under Keuangan; DOM and tab order follow the visual order (header, sidebar), focus ring visible; sheet closes with Escape, on navigation and with the close button, focus returns to "Menu"; nav has `aria-label`, groups are labelled sections with `h2`/`h3` headings; no horizontal scroll at 375 px for all roles. Screenshots at 1440 and 375 taken for all roles and compared with the pattern.
- Contrast computed from the tokens: sidebar label 7.6:1, active row 9.3:1, light sheet label 4.9:1, light tab 5.2:1, dark sheet label 6.8:1, dark tab 6.1:1. A real dark-theme screenshot was not captured (the theme toggle could not be driven from the test).
