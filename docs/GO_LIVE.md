# Go-live checklist

Work through the list in order and tick each line with the date. Deployment details are in `docs/DEPLOY.md`, backup and restore in `docs/RESTORE.md`.

## 1. Domain and access
- [ ] Production domain attached to the Vercel project; `NEXT_PUBLIC_SITE_URL` set to it (https, no trailing slash)
- [ ] Vercel Authentication switched off for production only after the steps below are done
- [ ] Preview deployments use a separate Supabase project or no service-role key

## 2. Environment variables (Vercel, production)
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- [ ] `SUPERADMIN_JWT_SECRET` (different from the club secret), `CRON_SECRET`
- [ ] `EMAIL_API_KEY`, `EMAIL_FROM`, `REPORT_NOTIFY_EMAIL`
- [ ] `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`
- [ ] `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_CONTACT_WHATSAPP`
- [ ] `MIDTRANS_SERVER_KEY` and `MIDTRANS_IS_PRODUCTION` match the Midtrans account mode, notification URL set to `/api/payments/midtrans`
- [ ] Redeploy after changing any variable

## 3. Email
- [ ] Sending domain verified at the email provider; SPF, DKIM and DMARC records published
- [ ] Test: registration verification, invitation and password reset mails arrive and the links open on the production domain

## 4. Database
- [ ] `supabase migration list` shows every file in `supabase/migrations` applied, in order
- [ ] Supabase backups enabled; point-in-time recovery decided; retention noted
- [ ] Restore drill from `docs/RESTORE.md` done and logged
- [ ] Demo and test accounts and demo organizations removed
- [ ] First superadmin created with `npm run seed:superadmin`, authenticator app enrolled, recovery codes stored in the password manager

## 5. Operations
- [ ] Uptime check on `/` and alert to a named person
- [ ] Error notifications from Vercel and Supabase routed to the same person
- [ ] Cron jobs (`/api/cron/generate-invoices`, `/api/cron/subscriptions`) visible in Vercel and a first run checked in the logs
- [ ] Support contact and response hours published on the contact page

## 6. Legal
- [ ] Privacy policy and terms reviewed by a lawyer; draft labels and `noindex` removed
- [ ] Legal entity, address and contact in the footer and in invoices
- [ ] Data retention periods in the policy match the purge settings

## 7. Smoke test on production
- [ ] Register a club, verify the email, log in and out
- [ ] Create a member, a package, a class and a booking; scan the check-in QR
- [ ] Create a POS order with payment; create and pay an invoice
- [ ] Personal account: sign up, post, send a friend request
- [ ] Superadmin login with the authenticator code

## 8. Rollback
- [ ] Previous production deployment noted as the rollback target (Vercel, promote the earlier deployment)
- [ ] Database rollback path: `docs/RESTORE.md`, section Real restore
