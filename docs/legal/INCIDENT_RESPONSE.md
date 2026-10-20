# Respons insiden data pribadi

Berlaku untuk kegagalan pelindungan data pribadi (akses tidak sah, kebocoran, perubahan, atau kehilangan data). Dasar: UU 27/2022 Pasal 46, pemberitahuan tertulis paling lambat 3 x 24 jam kepada subjek data dan lembaga yang berwenang.

## Penanggung jawab

| Peran | Siapa | Tugas |
|---|---|---|
| Koordinator insiden | pengelola N-1Labs (tetapkan nama dan nomor yang bisa dihubungi 24 jam) | memutuskan, mencatat, menandatangani pemberitahuan |
| Teknis | pemegang akses Vercel dan Supabase | menahan, menyelidiki, memulihkan |
| Komunikasi | pemegang kontak `NEXT_PUBLIC_CONTACT_EMAIL`/`NEXT_PUBLIC_CONTACT_WHATSAPP` | pemberitahuan ke pengguna dan klub |

Untuk data anggota klub, klub adalah pengendali; kabari pemilik klub terdampak lebih dulu agar klub dapat memberi tahu anggotanya.

## Langkah

Jam 0 dihitung sejak insiden diketahui.

1. **Catat** (jam 0): waktu diketahui, sumber laporan, sistem terdampak. Simpan bukti (log Vercel, log Supabase, `audit_log`) sebelum mengubah apa pun.
2. **Tahan** (jam 0-4):
   - Cabut sesi akun terdampak: `update accounts set sessions_valid_after = now() where id = any(...)`. Semua JWT yang terbit sebelumnya ditolak (`lib/auth/guard.ts`, `current_account_id()`).
   - Cabut semua sesi: `update accounts set sessions_valid_after = now();`
   - Nonaktifkan akun: `accounts.is_active = false`. Matikan klub: `clubs.is_active = false`.
3. **Rotasi kunci** bila kunci mungkin bocor, lalu deploy ulang:
   - `SUPABASE_JWT_SECRET` (dashboard Supabase, legacy JWT secret) dan `SUPABASE_SERVICE_ROLE_KEY`: semua sesi pengguna putus;
   - `SUPERADMIN_JWT_SECRET`: semua sesi superadmin putus;
   - `CRON_SECRET`, `MIDTRANS_SERVER_KEY` (dashboard Midtrans), `EMAIL_API_KEY` (Resend), `TURNSTILE_SECRET_KEY` (Cloudflare);
   - rahasia titik check-in: `update checkin_points set secret = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')`;
   - token Supabase dan Vercel pribadi pengelola.
4. **Selidiki** (jam 4-24): data apa, berapa akun dan klub, rentang waktu, penyebab. Gunakan `audit_log`, log Vercel, dan log Supabase.
5. **Beri tahu** (paling lambat jam 72): subjek data terdampak (email, atau lewat klub untuk anggota) dan lembaga yang berwenang di bidang pelindungan data pribadi. Isi minimal: data yang terungkap, kapan dan bagaimana, upaya penanganan dan pemulihan.
6. **Pulihkan**: perbaiki penyebab, pulihkan data dari cadangan bila perlu (`docs/RESTORE.md`), lalu pantau.
7. **Tutup**: tulis laporan akhir di `audit/` (kronologi, dampak, perbaikan, pencegahan) dan perbarui `docs/legal/DPIA.md` bila risikonya berubah.

## Templat pemberitahuan ke pengguna

> Subjek: Pemberitahuan insiden data pribadi di Ruzz
>
> Halo {nama},
>
> Pada {tanggal dan jam WIB} kami mengetahui adanya {jenis insiden} yang memengaruhi data akun Anda di Ruzz.
>
> Data yang terdampak: {daftar data}.
> Waktu kejadian: {rentang waktu}.
> Penyebab: {ringkasan}.
>
> Yang sudah kami lakukan: {mis. mencabut semua sesi, mengganti kunci, memperbaiki celah}.
> Yang kami sarankan untuk Anda: {mis. ganti kata sandi, waspadai email yang mengatasnamakan Ruzz}.
>
> Pertanyaan dapat diajukan ke {email} atau WhatsApp {nomor}.
>
> N-1Labs, pengelola Ruzz

## Templat pemberitahuan ke lembaga

> Perihal: Pemberitahuan kegagalan pelindungan data pribadi
>
> Pengendali: N-1Labs, {alamat}, Kota Semarang. Kontak: {nama, email, telepon}.
> Layanan: Ruzz ({URL}).
> Waktu diketahui: {tanggal dan jam WIB}. Waktu kejadian: {rentang}.
> Data pribadi yang terungkap: {jenis data, termasuk data spesifik bila ada: kesehatan, data anak}.
> Jumlah subjek data: {perkiraan}.
> Kronologi dan penyebab: {ringkasan}.
> Penanganan dan pemulihan: {langkah yang sudah dan akan dilakukan}.
> Pemberitahuan kepada subjek data: {tanggal dan cara}.

## Log insiden

| Tanggal | Ringkasan | Dampak | Pemberitahuan | Laporan |
|---|---|---|---|---|
| - | - | - | - | - |
