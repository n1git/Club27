# landing-sports progress

Status: done, pushed to `main`. Needs migration 065 on hosted to show all 18 sports in production.

## Design Read (taste-skill)

Landing: Reading this as: consumer-first sports landing that also sells a club plan, for people who train and for club owners in Indonesia, with the approved social-first language (Archivo display type, warm neutrals, yellow accent, ink for contrast), leaning toward Tailwind utilities + Archivo + Source Sans 3 + restrained motion. Dials: variance 6, motion 3, density 4. Only emphasis changes: copy, one new social tile and a sports grid; no new layout system.

Sport pages and `/sports`: Reading this as: SEO landing pages per sport for club owners, with the same quiet language, content first. Dials: variance 3, motion 2, density 4.

Pre-flight (checked on the running pages, light and dark, 1440 and 375 px): one h1 per page, h2 in order; every image has alt (0 without); links are real links with focus rings; no emoji; contrast uses the existing tokens (amber on cream 5.69:1, yellow only as a fill); hover motion is under `motion-reduce`; "Contoh data" label on every invented figure; claims table updated in `progress/landing-rework-progress.md`.

## What changed

- Landing: hero line with the sport count; free section retitled "Latihan lebih seru bersama teman" with a dark leaderboard, kudos and challenges tile; new `SportsSection` (`id="olahraga"`) before "Gabung klub"; header link "Olahraga"; the business section links to `/sports` instead of listing pills.
- `/sports`: hub with CollectionPage and ItemList data, in the sitemap and footer.
- `/sports/<code>`: own title, description (tagline plus first sentence of the intro), canonical, Open Graph image per sport, intro, use cases, FAQ (with FAQPage data that matches the visible text), price, and links to the other sports.
- `sport-content.ts` holds the text for 18 sports; an unknown sport gets generated text.

Screenshots: `progress/landing-sports/` (landing light and dark, landing mobile, `/sports`, `/sports/futsal`, `/sports/running` mobile dark).

## Checks

- `npx tsc --noEmit` and eslint on the changed folders are clean.
- Browser check against a local database with the 18 sports: titles, descriptions, canonical, `og:image`, JSON-LD types and h1 per page; no image without alt.
- Not run: Google's Rich Results Test (a web tool that needs a public URL; no API) and a check of the live Vercel site (no traffic was sent to it).

## Notes

- `og:image` on `/sports` points to the shared `/opengraph-image`; other static pages (`/privacy`, `/terms`, `/signup`) still get no `og:image` because `pageMetadata` replaces the root Open Graph object. Not changed here.
- The sport OG image uses the default font weight; adding a bold font would need a font file in the repo.

## Lighthouse and structured data (local production build, 2026-10-21)

Lighthouse 13.5 against `next build` + `next start` on a local database with 18 sports, mobile and desktop presets:

| Page | Mobile (perf / a11y / best / SEO) | Desktop |
|---|---|---|
| `/` | 87 / 100 / 100 / 100 (LCP 3.4 s, TBT 260 ms, CLS 0) | 100 / 100 / 100 / 100 |
| `/sports` | 92 / 100 / 100 / 100 (LCP 3.3 s) | 100 / 100 / 100 / 100 |
| `/sports/futsal` | 92 / 100 / 100 / 100 (LCP 3.3 s) | 100 / 100 / 100 / 100 |
| `/sports/running` | 91 / 100 / 100 / 100 (LCP 3.4 s) | 100 / 100 / 100 / 100 |

The only failing binary audit is back/forward cache (`bf-cache`). Mobile numbers use Lighthouse's throttled profile; the landing is the slowest (87) because it renders per request with the CSP nonce.

Finding fixed: the first run scored SEO 92 on every sport page because the meta description was streamed into `<body>` (Next streams metadata for normal browsers and for plain `Googlebot`, which is not in the default limited-bot list), so `<head>` had a title but no description. `htmlLimitedBots: /.*/` in `next.config.ts` makes metadata blocking for every user agent; description, canonical and Open Graph tags are now in `<head>` and SEO is 100 on all four pages. Cost: the first byte waits for `generateMetadata` (one database read on these pages). Other pages with async metadata benefit too.

Structured data check (script reading the built pages; this stands in for Google's Rich Results Test, which could not be run):
- `/`: Organization, WebSite, SoftwareApplication. `/sports`: BreadcrumbList, CollectionPage (ItemList). `/sports/<code>`: BreadcrumbList, WebPage, SoftwareApplication, FAQPage.
- Breadcrumb positions, names and URLs complete; every FAQ question and answer also appears in the visible text; offers carry price and currency; parsing succeeds for all blocks.
- Eligibility notes: Google shows the software-app rich result only with `aggregateRating` or `review`, which we do not have and will not invent, so the pages are valid but not eligible. Google shows FAQ rich results only for well-known government and health sites, so the FAQPage data helps understanding of the page but should not be expected to produce a rich result.

To run the real tools after deploy: https://search.google.com/test/rich-results and https://pagespeed.web.dev with `https://<site>/sports/futsal`.
