# rebrand-ruzz progress

Status: Phase 0 done.

- [x] Phase 0: inventory, token table, Design Read
- [ ] Phase 1: name and copy
- [ ] Phase 2: logo assets
- [ ] Phase 3: tokens and type
- [ ] Phase 4: page sweep and screenshots

Logo files: `ruzz-italic.zip` (read `description.txt`; its hex values win: yellow `#FFD21F`, ink `#111214`, white `#FFFFFF`, blush red `#E5412B` for the logo dot only). The zip notes the name "Ruzz" has not passed a brand or IP check.

Lockup files named `lockup-white` and `lockup-black` have a solid background (white and `#111214`). In the UI the `-transparent` variants (same colours, no background) are used so the logo sits on warm-neutral cards without a visible white box.

## Inventory (before)

"27 Club" or "27club" (excluding `progress/`, `docs/CHANGELOG.md` history and applied migrations):
- Code: `lib/config.ts` (`APP_NAME` default), `lib/validations/auth.ts` (weak-password list: stays, it lists passwords), `.env.example`.
- Assets: `app/icon.svg`, `public/brand/{favicon.svg,icon-a1-volt.svg,icon-a2-charcoal.svg}` (aria-label).
- Docs: `README.md`, `CLAUDE.md`, `PRODUCT_BLUEPRINT.md`, `KAJIAN_PAKET.md`, `docs/ARCHITECTURE.md`, `docs/DEPLOY.md`, `docs/DB_NAMING_AUDIT.md`.
- Applied migrations with the old name in messages: `000031_brand_name`, `000035_subscription_renewals`, `000042_seats_billing` (never edited; a new migration replaces the messages). `000036_brand_name_27club`, `000046`, `000055` also mention it and were checked in Phase 1.

Old volt and green-ink values (`#c8f31d`, `#4d6400`, `#6b8a00`, `rgb(30 36 8`):
- `app/globals.css`: `--primary`, `--accent-foreground`, `--ring`, `--shadow-ink`, `--sidebar-accent` (light and dark), `.phone-screen` (`--ph-volt`, `--ph-deep`, `--ph-tint`).
- `public/brand/*` (old logo files), `app/icon.svg`.
- Docs: `CLAUDE.md`, `docs/ARCHITECTURE.md`, `PRODUCT_BLUEPRINT.md`, `docs/CHANGELOG.md` (history, left as is).

Other hard-coded colours in `app/`, `components/`, `lib/`:
- `#0e0e0e` (old ink): `app/opengraph-image.tsx`, `components/ui/button.tsx`, `components/landing/{phone-stage,cta}.tsx`, `.phone-screen` in `globals.css`.
- `#f2f2ee`, `#a6a69e`, `#3a3a35`, `#26261f`: `opengraph-image.tsx`, `phone-stage.tsx`, `cta.tsx`.
- `#2c3300` (olive text on volt): `components/landing/final-cta.tsx`.
- `rgb(30_36_8/...)` arbitrary shadow: `components/landing/join-section.tsx`.
- `#2563eb`: placeholder and error text for the club colour field (an example of club data, not a theme colour; stays).

Text marks: `components/shared/brand-logo.tsx` already uses images; `app/superadmin/login/page.tsx` passes `${APP_NAME} Platform` as page title (plain text, stays).

## Token table

| Token | Light old | Light new | Dark old | Dark new |
|---|---|---|---|---|
| `--foreground`, `--card-foreground`, `--primary-foreground`, `--sidebar-foreground`, `--secondary-foreground` | `#0e0e0e` | `#111214` | `#f2f2ee` (fg) | `#f2f2ee` |
| `--primary`, `--sidebar-accent` | `#c8f31d` | `#FFD21F` | `#c8f31d` | `#FFD21F` |
| `--accent-foreground` (accent text, links) | `#4d6400` | `#7A5A00` | `#c8f31d` | `#FFD21F` |
| `--ring` | `#4d6400` | `#7A5A00` | `#c8f31d` | `#FFD21F` |
| `--background` | `#f2f2ee` | `#f2f2ee` (kept) | `#0e0e0e` | `#111214` |
| `--card` | `#fbfbf8` | `#fbfbf8` (kept) | `#171716` | `#1a1b1d` |
| `--sidebar` (dark) | `#fbfbf8` | kept | `#121211` | `#141517` |
| `--secondary`, `--muted`, `--accent`, `--border`, `--input` (dark) | warm greys | kept | `#21211f`, `#2c2c29` | `#232426`, `#2e2f32` |
| `--muted-foreground` (dark) | `#57574f` | kept | `#a6a69e` | `#a6a7ab` |
| `--shadow-ink` | `rgb(30 36 8 / .14)` | `rgb(17 18 20 / .14)` | `rgb(0 0 0 / .55)` | kept |
| `.phone-screen` `--ph-ink`, `--ph-volt`, `--ph-deep`, `--ph-tint` | `#0e0e0e`, `#c8f31d`, `#4d6400`, volt 30% | `#111214`, `#FFD21F`, `#7A5A00`, yellow 30% | n/a | n/a |

Warm-neutral light surfaces are kept: the audit found no clash with `#111214` (ink on `#f2f2ee` is 16.7:1). `--destructive`, `--success`, `--warning` are unchanged; blush red `#E5412B` is used only inside the logo files.

### Contrast (WCAG, measured)

| Pair | Ratio | Needed |
|---|---|---|
| Light accent text `#7A5A00` on `--background` `#f2f2ee` | 5.69 | 4.5 |
| `#7A5A00` on `--card` `#fbfbf8` | 6.16 | 4.5 |
| `#7A5A00` on `--secondary` `#e6e6e0` | 5.09 | 4.5 |
| Ink `#111214` on primary `#FFD21F` | 12.93 | 4.5 |
| Ink on `#f2f2ee` | 16.70 | 4.5 |
| Dark: `#FFD21F` on `#111214` | 12.93 | 4.5 |
| Dark: `#FFD21F` on card `#1a1b1d` | 11.89 | 4.5 |
| Light ring `#7A5A00` on `#f2f2ee` | 5.69 | 3 (non-text) |

Yellow `#FFD21F` on `#f2f2ee` is only 1.29:1, so on light pages it is a fill (buttons, active nav, badges), never text or a focus ring. The lighter amber `#8A6500` passes on background and card (4.75, 5.14) but fails on `--secondary` (4.25), so `#7A5A00` stays.

## Design Read (taste-skill)

- Landing: Reading this as: consumer-first sports landing that also sells a club-management plan, for people who train and for club owners in Indonesia, with a bold sporty italic language (Archivo 800 condensed upright display on warm neutrals, one yellow accent, ink for contrast), leaning toward Tailwind utilities + Archivo + Source Sans 3 + restrained motion. Dials: variance 6, motion 4, density 4. The layout is the approved social-first one; only colour, type and logo change.
- Auth (`/login`, `/signup`, `/signup/account`, `/forgot-password`, `/reset-password`, `/invite`, `/superadmin/login`): Reading this as: task-first sign-in and sign-up forms for athletes, club staff and platform admins, with a quiet high-contrast language, leaning toward the app tokens + lockup above the card + no decoration. Dials: variance 3, motion 2, density 4.

Pre-flight per page runs in Phase 4, against the built page.
