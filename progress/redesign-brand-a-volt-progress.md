# redesign-brand-a-volt progress

Status: all phases done.

- [x] Phase 0 — audit reused, Design Read, mocks
- [x] Phase 1 — tokens, fonts, brand assets, icons, OG image
- [x] Phase 2 — shell and shared components
- [x] Phase 3 — landing and auth pages
- [x] Phase 4 — page sweep, after screenshots, changelog

Replaces `redesign-brand-c`. Logo A in the volt palette uses the same palette as logo C, so the audit and token table from `progress/redesign-brand-c-progress.md` are reused as they stand. Logo files: `27club-brand-a-volt.zip` (unpacked to `public/brand/` in Phase 1).

## Phase 0

Commit: this file. No code changed; the mock was applied locally, screenshotted and reverted.

### Design Read (taste-skill)

- Landing: Reading this as: B2B SaaS landing for club owners and managers of sports clubs in Indonesia, with a bold sporty language (condensed italic display type on near-black, one volt accent), leaning toward Tailwind utilities + Barlow Condensed 800 italic + Source Sans 3 + restrained motion. Dials: variance 6, motion 4, density 4 (trust and clarity for people who sign up and pay; the hero is allowed to be loud, the rest is calm).
- Auth (`/login`, `/daftar`, `/superadmin/login`, `/change-password`): Reading this as: task-first sign-in and sign-up forms for club staff, members and platform admins, with a quiet, high-contrast language, leaning toward the app tokens + full logo above the card + no decoration. Dials: variance 3, motion 2, density 4.

Pre-flight per page is run in Phase 3, against the built page.

### Findings (from redesign-brand-c)

Shell and shared components
1. Colours are already central: every token is in `app/globals.css`. Outside it, old colours remain only in `app/opengraph-image.tsx` (`#0a2f4d`, `#7dd3fc`, `#9cc6e0`, `#e5f1fa`) and the `#2563eb` placeholder of the club colour field (`components/settings/tenant-branding-form.tsx`, an example value for club data, not a theme colour). The `0369a1`, `38bdf8` and `sky-` matches are all in `globals.css`.
2. `text-primary` is used 40 times as a text colour (club name in the top bar, links, landing labels). Once `--primary` is volt, that text drops to 1.15:1 on the light background. Plan: these become `text-accent-foreground` (dark volt in light, volt in dark). `border-primary` (10) and `bg-primary` (20) stay, because they are fills and borders.
3. The `h1`–`h6` font rule in `globals.css` sits outside any layer, so it beats Tailwind utilities (a heading cannot take another font class). It moves into `@layer base`.
4. `font-heading` (Lexend) is used 24 times. Per decision 2 it maps to Source Sans 3, and a new `font-display` (Bebas Neue) is used only for the `PageHeader` title, `MetricCard` values and the landing hero.
5. The sidebar mark is `APP_NAME.charAt(0)`, which renders "2" for "27 Club". It gets replaced by the logo.
6. Sidebar group labels and landing section labels are uppercase with wide tracking (5 places), a generic pattern the skill flags.
7. The favicon is the default `app/favicon.ico`; there is no `icon.svg`, `apple-icon.png` or brand OG image.

Pages
8. Member home (`/member`): sections are bare headings and tables, without the framed cards the admin pages use, so it looks unfinished next to the rest.
9. Auth pages (`/login`, `/daftar`, `/superadmin/login`, `/change-password`) use `Card frame={false}` on the old blue-tinted background, with no brand mark beyond text.
10. Superadmin portal: its own header with a text-only `APP_NAME Platform` mark.
11. Coach pages: same shell as admin; no one-off colours found.
12. Landing: the hero is a light block with the product preview; the header and footer use a text mark in `text-primary`.

Seen in the mock (needs a decision, see below)
13. Bebas Neue has capitals only. Numbers look strong ("1 / 0", "18"), but text values become shouted and truncated ("BELUM ADA JAM BU…", "RP 0 (0 PESANAN)").
14. A volt button on the light background has almost no edge (1.15:1 against `#F2F2EE`). The label is 15:1, so it passes WCAG, but the button shape is faint.

### Token table (measured, WCAG contrast ratio)

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F2F2EE` | `#0E0E0E` |
| `--foreground` | `#0E0E0E` (17.2:1 on background) | `#F2F2EE` (17.2:1) |
| `--card` | `#FBFBF8` (foreground 18.6:1) | `#171716` (foreground 16.0:1) |
| `--muted` / `--secondary` / `--accent` (surfaces) | `#E6E6E0` | `#21211F` |
| `--muted-foreground` | `#57574F` (6.5:1 background, 7.0:1 card, 5.8:1 muted) | `#A6A69E` (7.9:1, 7.3:1, 6.6:1) |
| `--primary` / `--primary-foreground` | `#C8F31D` / `#0E0E0E` (15.0:1) | same |
| `--accent-foreground` (accent text, links) | `#4D6400` (6.0:1 background, 6.5:1 card, 5.3:1 muted) | `#C8F31D` (15.0:1, 13.9:1, 12.5:1) |
| `--ring` (focus) | `#4D6400` (6.0:1) | `#C8F31D` (15.0:1) |
| `--border` / `--input` | `#D6D6CE` | `#2C2C29` |
| `--success` | `#276B2B` (white text 6.4:1) | `#6FD38A` (10.4:1 on background) |
| `--warning` | `#9A5800` (white text 5.6:1, 5.0:1 on background) | `#F5B544` (10.6:1) |
| `--destructive` | `#C62828` (white text 5.6:1, 5.0:1 on background) | `#FF7A6E` (7.6:1) |
| Sidebar active item | `#C8F31D` fill, `#0E0E0E` text (15.0:1) | same |

The logo's own dark volt (`#6B8A00`, 3.6:1) is used only inside the logo file, never as text colour.

### Mock (logo A volt, Barlow Condensed 800 italic, light and dark)

Applied locally and reverted: palette tokens from the table above, `font-display` for `PageHeader`, numeric `MetricCard` values and the landing hero, h1–h6 rule in `@layer base`, `text-primary` remapped to the accent text colour, theme-following sidebar with volt active item, logo in sidebar and landing header, dark landing hero, volt button with a 15% black border in light mode, sentence-case labels.

Before (old UI): ![landing](redesign-brand-a-volt/before-landing.png) ![admin](redesign-brand-a-volt/before-admin.png) ![member](redesign-brand-a-volt/before-member.png)

Mock light: ![landing](redesign-brand-a-volt/mock-landing.png) ![admin](redesign-brand-a-volt/mock-admin.png) ![member](redesign-brand-a-volt/mock-member.png)

Mock dark: ![landing](redesign-brand-a-volt/mock-dark-landing.png) ![admin](redesign-brand-a-volt/mock-dark-admin.png) ![member](redesign-brand-a-volt/mock-dark-member.png)

### Notes from the mock

1. The logo files carry about 20% empty margin on every side. At 48 px tall the wordmark itself is about 25 px and "CLUB" is still unreadable. Fix options: use a tighter viewBox (crop the SVG) or give the logo 64 px height. The header is 64 px, so cropping the viewBox is the cleaner choice. Decision 3 says the full logo only at 48 px or more; with the current margins that rule is not enough.
2. The landing header on light pages shows the logo at the same weight as before, but the volt "7" in the light logo is `#6B8A00` (3.6:1), fine as a graphic.
3. The `MetricCard` sparkline falls back to `text-primary`, which resolves to dark volt in the mock; with a real volt `--primary` it needs `text-accent-foreground` (covered by finding 2).
4. Volt is used for the active nav item, primary buttons and nothing else; light pages stay off-white. The volt fill on the active nav item is heavy on admin because it is the largest volt area on screen; kept as decided.
5. Member home is still bare headings and tables (finding 8); Phase 4 recomposes it into framed sections.

Decision: full logo at 64 px tall (option 2), icon on mobile.

## After

Checks: `grep -rE "0369a1|38bdf8|sky-|Lexend" app components` returns nothing; scrollWidth equals viewport at 375 px on the landing page, `/admin` and `/member`; contrast per the token table above (unchanged values).

Light: ![landing](redesign-brand-a-volt/after-landing.png) ![admin](redesign-brand-a-volt/after-admin.png) ![member](redesign-brand-a-volt/after-member.png)

Dark: ![landing](redesign-brand-a-volt/after-dark-landing.png) ![admin](redesign-brand-a-volt/after-dark-admin.png) ![member](redesign-brand-a-volt/after-dark-member.png)

Auth: ![login](redesign-brand-a-volt/after-login.png) ![daftar](redesign-brand-a-volt/after-daftar.png) ![superadmin](redesign-brand-a-volt/after-superadmin-login.png)

Mobile 375: ![landing](redesign-brand-a-volt/m375-landing.png) ![admin](redesign-brand-a-volt/m375-admin.png) ![member](redesign-brand-a-volt/m375-member.png)
