# billing-renewal

Status: selesai; migrasi 035 diterapkan ke hosted 2026-10-12.

- [x] Fase 1 - migrasi 035: status `expired`, `subscription_renewals`, `subscription_reminders`, `request_renewal`, `confirm_renewal` (idempoten, periode menyambung), `expire_subscriptions`, `enforce_billing_gate` menolak periode lewat. Diuji di audit_full (expire, ajukan dua kali, konfirmasi ulang, konfirmasi yang dibatalkan ditolak).
- [x] Fase 2 - kunci akses: `isBillingLocked` di `checkSession`; pemilik diarahkan ke `/admin/klub/langganan`, pengguna lain keluar dengan `?expired=1`; `template.tsx` admin/coach/member; aksi server dikunci kecuali `allowBillingLocked`.
- [x] Fase 3 - perpanjangan: form pemilik (`submitRenewal`, menggantikan ubah paket langsung), daftar dan konfirmasi di superadmin (`confirmRenewalPayment`), fungsi `confirmRenewal` siap dipakai webhook gateway.
- [x] Fase 4 - pengingat: banner H-7 (trial selalu), cron harian `/api/cron/subscriptions` 07.00 WIB, email H-7/H-1 bila `EMAIL_API_KEY` diisi.
- [x] Fase 5 - dokumen: S&K, FAQ landing, KAJIAN_PAKET, CLAUDE.md.

Cek: `npx next typegen && npx tsc --noEmit` lolos. Belum diuji di browser (build tidak diminta).
