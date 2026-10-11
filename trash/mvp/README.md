# Swimma MVP (static demo)

A fully client-side demo of the Swimma swimming-club app, built for
GitHub Pages where no server can run. Every "database" is a single
localStorage blob in your browser — there is no backend, no real
authentication, and no data shared between devices or people.

## This is not the real app

The production app (repo root, Next.js + Supabase) is what actually runs the
club — real bcrypt password hashing, a real Postgres database, and Row Level
Security enforced server-side. This `mvp/` folder exists only because
GitHub Pages can't host that app (it needs a live server for login, Server
Actions, and per-user data). This demo swaps all of that for plain
JavaScript running entirely in your browser, so it can double as a
click-through preview.

**Do not treat this as secure.** Passwords are stored in plaintext in
localStorage, `role` is just a value anyone can edit via devtools, and there
is no server enforcing who can see or change what. It is a UI/workflow demo,
not a security boundary.

## Running locally

```bash
npm install
npm run dev
```

## Demo accounts

Seeded automatically on first load (see `src/lib/seed.ts`):

| Role   | Email             | Password  |
| ------ | ----------------- | --------- |
| Admin  | admin@demo.dev    | admin123  |
| Coach  | coach1@demo.dev   | coach123  |
| Coach  | coach2@demo.dev   | coach123  |
| Parent | parent1@demo.dev  | parent123 |
| Parent | parent2@demo.dev  | parent123 |

To start over, clear this site's storage in your browser, or run
`localStorage.clear()` in devtools.

## Notes

- Promo images are stored as base64 data URLs directly in localStorage
  (capped at 500KB per image in the upload form) — localStorage has a
  roughly 5-10MB ceiling per origin, so this is only workable for a small
  amount of demo content.
- Deployed via `.github/workflows/deploy-mvp-pages.yml` on every push to
  `main` that touches this folder. The repo's Settings → Pages source must
  be set to "GitHub Actions" once for the deploy step to succeed.
