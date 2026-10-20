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
- Not run: Lighthouse, Search Console rich result test, and a production deploy check (production lists only the sports in its `club_types`: 6 until migration 065 is applied).

## Notes

- `og:image` on `/sports` points to the shared `/opengraph-image`; other static pages (`/privacy`, `/terms`, `/signup`) still get no `og:image` because `pageMetadata` replaces the root Open Graph object. Not changed here.
- The sport OG image uses the default font weight; adding a bold font would need a font file in the repo.
