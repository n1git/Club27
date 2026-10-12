# redesign-brand-c progress

Status: Phase 0 done, waiting for OK.

- [x] Phase 0 — audit, token table, before and mock screenshots
- [ ] Phase 1 — tokens, fonts, brand assets, icons
- [ ] Phase 2 — shell and shared components
- [ ] Phase 3 — landing and auth pages
- [ ] Phase 4 — page sweep, after screenshots, changelog

Precondition checked: `progress/profile-username-progress.md` has all five phases done.

## Phase 0 — audit (done)

Commits: `8bf192b` (CLAUDE.md builder workflow), this file. Check: no code changed in this phase; the mock was applied locally, screenshotted and reverted.

### Findings

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

### Screenshots (1440 × 900, light; dark mock for the member page)

Before:
- ![landing](redesign-brand-c/before-landing.png)
- ![admin](redesign-brand-c/before-admin.png)
- ![member](redesign-brand-c/before-member.png)

Mock (new tokens, Bebas Neue display, logo in the sidebar and landing header, dark hero):
- ![landing](redesign-brand-c/mock-landing.png)
- ![admin](redesign-brand-c/mock-admin.png)
- ![member](redesign-brand-c/mock-member.png)
- Dark: ![landing](redesign-brand-c/mock-dark-landing.png) ![admin](redesign-brand-c/mock-dark-admin.png) ![member](redesign-brand-c/mock-dark-member.png)

### Waiting for OK — open visual decisions

1. **Sidebar in light mode:** follow the theme (off-white sidebar with `logo-c-on-light`, as in the mock), or stay dark (`#0E0E0E` with `logo-c-on-dark`) in both themes? Decision 3 suggests following the theme.
2. **`MetricCard` values:** Bebas Neue for numbers and amounts only, with text values ("Belum ada jam buka") in Source Sans 3, or Bebas for every value?
3. **Volt button edge on light pages:** add a thin `#0E0E0E` border at 15% opacity to primary buttons in light mode, or leave the fill as is?
4. **Uppercase labels:** change the sidebar group labels and the landing section labels to sentence case, or keep the uppercase small labels?
