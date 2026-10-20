export const CONSENT_VERSION = "2026-10-20";

export const CONSENT_LABEL = "Saya berusia 18 tahun ke atas dan menyetujui Syarat & Ketentuan dan Kebijakan Privasi";

export const CONSENT_REQUIRED_ERROR = "Centang pernyataan usia 18 tahun ke atas dan persetujuan Syarat & Ketentuan serta Kebijakan Privasi";

export interface ConsentItem {
  title: string;
  body: string;
  list?: string[];
}

export const CONSENT_ITEMS: ConsentItem[] = [
  {
    title: "Usia",
    body: "Saya berusia 18 tahun ke atas. Anak di bawah 18 tahun hanya dapat didaftarkan oleh klub dengan persetujuan orang tua atau wali.",
  },
  {
    title: "Penyedia infrastruktur dan transfer ke luar negeri",
    body: "Data saya diproses oleh penyedia berikut. Sebagian data disimpan atau diproses di luar Indonesia.",
    list: [
      "Supabase: basis data dan penyimpanan berkas, Jepang (Tokyo).",
      "Vercel: hosting aplikasi, Amerika Serikat (Washington, D.C.).",
      "Resend: pengiriman email, Amerika Serikat.",
      "Cloudflare Turnstile: pemeriksaan anti-bot saat mendaftar, Amerika Serikat.",
      "Midtrans: pembayaran langganan, Indonesia.",
    ],
  },
  {
    title: "Masa simpan",
    body: "Data akun dan klub disimpan selama akun atau langganan berjalan. Setelah langganan berakhir, data klub hanya dapat dibaca selama satu tahun. Log audit disimpan 5 tahun. Akun pribadi yang tidak login selama 3 tahun dapat dihapus. Catatan keuangan dapat disimpan lebih lama bila diwajibkan peraturan.",
  },
  {
    title: "Bukti persetujuan",
    body: "Bukti persetujuan (versi, tanggal, dan jenis persetujuan) tetap disimpan setelah akun dihapus untuk membuktikan dasar pemrosesan, tanpa data lain.",
  },
  {
    title: "Pemberitahuan insiden",
    body: "Bila terjadi kegagalan pelindungan data pribadi, kami memberi tahu Anda dan lembaga yang berwenang paling lambat 3 x 24 jam setelah diketahui.",
  },
  {
    title: "Kontak pejabat pelindungan data",
    body: "Pertanyaan dan permintaan tentang data pribadi dapat diajukan melalui kontak berikut.",
  },
];

export const HEALTH_CONSENT_TEXT =
  "Saya setuju Ruzz menyimpan tinggi dan berat badan saya untuk menghitung IMT. Data ini hanya dapat dilihat oleh saya, tidak ditampilkan ke klub, pelatih, teman, grup, feed, atau peringkat. Saya dapat menarik persetujuan kapan saja di Pengaturan, dan semua catatan kesehatan saya akan dihapus.";
