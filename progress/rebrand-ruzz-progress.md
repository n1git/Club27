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

## Phase 1

Name and copy changed: `lib/config.ts` default `APP_NAME` = "Ruzz"; `.env.example`, `README.md`, `docs/DEPLOY.md`, `docs/ARCHITECTURE.md`, `CLAUDE.md`, `PRODUCT_BLUEPRINT.md`, `KAJIAN_PAKET.md` (also the plan name "Ruzz Plus"); `ruzz` added to `RESERVED_USERNAMES`; one CHANGELOG entry. `lib/validations/auth.ts` keeps `27club...` in the weak-password list on purpose.

Migrations written, NOT applied to hosted (for the owner):
- `20250101000059_rebrand_ruzz_messages.sql`: `enforce_billing_gate(uuid)` and `enforce_org_club_limit()` with only the "Hubungi admin platform ..." brand word changed to "Ruzz". Bodies copied from `pg_get_functiondef` of a fully migrated local database (the latest definitions, not the ones in 031, 035, 042, 036, 046). Migrations 031, 035 and 042 were not touched; their messages were already replaced by later migrations, except the two above.
- `20250101000060_rename_plus_plan.sql`: sets `subscription_plans.name` from "27 Club Plus" to "Ruzz Plus" for `plus` (the landing, sign-up and renewal read the name from the table, so without it the old name would still show). Not requested in the task; delete the file if you want to keep the old plan name.
- Both ran in a rolled-back transaction on a local database (functions replaced, plan renamed, no function left with the old brand).

## Phase 2

- `public/brand/` now holds only the 14 files from the zip (SVG and PNG); all `logo-a-*`, `icon-a*`, `favicon.*` and `apple-touch-icon.png` removed.
- `BrandLogo` (lockup, `h-10` default = 40 px, so never below the minimum) uses `lockup-white-transparent` in light and `lockup-black-transparent` in dark, switched with the `dark` class. `BrandIcon` uses `icon-yellow` in light and `icon-black` in dark; the old ring and radius classes were dropped because the tile is already rounded.
- Wired through the existing components: sidebar, app header (icon on mobile), landing header and footer, auth pages, status pages, superadmin header.
- `app/icon.svg` = `icon-yellow.svg`; `app/favicon.ico` (16, 32, 48 px) and `app/apple-icon.png` (180 px, square tile without rounded corners so iOS can mask it) rendered from the same icon.
- `app/opengraph-image.tsx`: ink `#111214` background, dark lockup, muted text `#a6a7ab`. JSON-LD organization logo now the yellow icon PNG (512 px).
