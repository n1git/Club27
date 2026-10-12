import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LEGAL_DOMICILE, LEGAL_OPERATORS, LegalContact, LegalPage } from "@/components/landing/legal-page";
import { PRIVACY_VERSION } from "@/lib/privacy";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: `Kebijakan privasi ${APP_NAME}: data yang disimpan, tujuan, penyedia layanan, dan hak Anda.`,
  alternates: { canonical: "/privasi" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="12 Oktober 2026">
      <p>
        {APP_NAME} adalah aplikasi untuk mengelola klub olahraga. Kebijakan ini menjelaskan data pribadi apa yang
        diproses di dalam aplikasi, untuk apa, siapa yang bertanggung jawab, dan bagaimana Anda dapat memakai hak Anda
        sesuai Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Versi kebijakan:{" "}
        <strong>{PRIVACY_VERSION}</strong>.
      </p>

      <h2>1. Siapa kami dan siapa yang bertanggung jawab</h2>
      <p className="ringkas">Ringkasnya: data anggota adalah milik klub; kami mengolahnya atas nama klub.</p>
      <p>
        {APP_NAME} dikelola oleh {LEGAL_OPERATORS}, berkedudukan di {LEGAL_DOMICILE} (selanjutnya &ldquo;kami&rdquo;).
      </p>
      <ul>
        <li>
          Untuk data akun pemilik, data langganan, dan catatan keamanan platform, kami adalah <strong>pengendali data</strong>.
        </li>
        <li>
          Untuk data anggota, staf, dan kegiatan sebuah klub, <strong>klub adalah pengendali data</strong> dan kami adalah{" "}
          <strong>prosesor data</strong> yang memproses data itu hanya untuk menjalankan aplikasi bagi klub. Ketentuan
          pemrosesan ini diatur di bagian &ldquo;Pemrosesan data atas nama klub&rdquo; pada{" "}
          <Link href="/syarat#pemrosesan-data" className="font-medium text-primary underline-offset-4 hover:underline">
            Syarat & Ketentuan
          </Link>
          .
        </li>
        <li>Permintaan tentang data anggota sebaiknya diajukan lebih dulu kepada klub. Kami akan membantu klub menanganinya.</li>
      </ul>

      <h2>2. Data yang kami proses</h2>
      <p className="ringkas">Ringkasnya: hanya data yang diperlukan untuk menjalankan klub. Kata sandi tidak pernah disimpan dalam bentuk asli.</p>
      <ul>
        <li>Pemilik organisasi: nama, email, nama pengguna, kata sandi dalam bentuk hash bcrypt, waktu login terakhir, dan jumlah percobaan login gagal.</li>
        <li>Staf klub (admin, pelatih, resepsionis, keuangan): nama, email, nama pengguna, nomor telepon bila diisi, peran, data profil pelatih bila diisi, dan kata sandi dalam bentuk hash.</li>
        <li>
          Anggota: nama, tanggal lahir, alamat, catatan, lokasi pilihan, pelatih, serta nama dan nomor telepon kontak
          (misalnya orang tua) bila diisi oleh klub. Anggota dapat berupa anak.
        </li>
        <li>Akun anggota (bila diaktifkan klub): email, nama pengguna, dan kata sandi dalam bentuk hash.</li>
        <li>Kegiatan klub: jadwal kelas, booking kelas dan fasilitas, kehadiran beserta catatan pelatih, paket anggota, tagihan, pesanan kasir, pembayaran yang dicatat manual, buku kas, dan gaji pelatih.</li>
        <li>Check-in: anggota, titik check-in, waktu, paket, dan cara check-in. Alamat IP dan data perangkat tidak disimpan.</li>
        <li>Booking tamu dan pesanan kasir tanpa anggota: nama dan nomor telepon bila diisi.</li>
        <li>Gambar promo yang diunggah klub.</li>
        <li>Catatan persetujuan: siapa yang setuju, versi kebijakan, waktu, nama wali bila anggota masih anak, dan staf yang mencatat.</li>
        <li>Log audit: tindakan penting (misalnya atur ulang kata sandi, perubahan status, pembatalan) beserta pelaku dan waktunya, tanpa kata sandi.</li>
        <li>Pembatasan percobaan login dan pendaftaran: alamat IP disimpan sementara sebagai penghitung dan dihapus dalam sekitar satu hari.</li>
      </ul>
      <p>Kami tidak memproses data pembayaran kartu atau rekening, karena aplikasi tidak menerima pembayaran online.</p>

      <h2>3. Tujuan dan dasar pemrosesan</h2>
      <ul>
        <li>Menyediakan akun, langganan, dan fitur aplikasi: pelaksanaan perjanjian dengan pemilik.</li>
        <li>Mengelola anggota, kelas, kehadiran, tagihan, dan kasir atas nama klub: dasar pemrosesan yang dimiliki klub, umumnya persetujuan anggota atau walinya dan pelaksanaan perjanjian keanggotaan.</li>
        <li>Menjaga keamanan akun, mencegah penyalahgunaan, dan mencatat log audit: kepentingan yang sah untuk melindungi pengguna dan data.</li>
        <li>Menyimpan catatan keuangan: pemenuhan kewajiban hukum klub dan kami.</li>
      </ul>
      <p>Kami tidak menjual data pribadi, tidak memakainya untuk iklan, dan tidak membuat profil perilaku pengguna.</p>

      <h2>4. Data anak</h2>
      <p className="ringkas">Ringkasnya: anggota di bawah 18 tahun hanya dapat dicatat dengan persetujuan orang tua atau wali.</p>
      <p>
        Saat klub menambah anggota berusia di bawah 18 tahun, aplikasi mewajibkan staf mencatat persetujuan orang tua
        atau wali beserta namanya. Klub bertanggung jawab memastikan persetujuan itu benar-benar diperoleh. Orang tua
        atau wali dapat meminta akses, perbaikan, atau penghapusan data anaknya melalui klub atau melalui kontak kami.
      </p>

      <h2>5. Penyedia layanan dan transfer ke luar negeri</h2>
      <p className="ringkas">Ringkasnya: data disimpan di server penyedia layanan di luar Indonesia.</p>
      <ul>
        <li>Supabase: basis data dan penyimpanan berkas, server di Tokyo, Jepang.</li>
        <li>Vercel: hosting aplikasi; permintaan dapat dilayani dari server di luar Indonesia.</li>
        <li>Resend (bila diaktifkan): pengiriman email verifikasi; menerima alamat email dan isi email.</li>
        <li>Cloudflare Turnstile (bila diaktifkan): pemeriksaan anti-bot pada formulir; menerima alamat IP dan sinyal peramban.</li>
      </ul>
      <p>
        Karena itu data pribadi ditransfer ke luar wilayah Indonesia. Kami memilih penyedia yang menerapkan standar
        keamanan dan pelindungan data yang diakui secara internasional dan hanya memberikan data yang diperlukan untuk
        layanan masing-masing. Daftar ini akan kami perbarui bila penyedia berubah.
      </p>

      <h2>6. Cookie dan penyimpanan di peramban</h2>
      <ul>
        <li>Cookie sesi <code>app_session</code> (httpOnly, berlaku hingga 7 hari) untuk menjaga Anda tetap masuk.</li>
        <li>Cookie <code>superadmin_session</code> dan <code>superadmin_mfa</code> hanya untuk tim pengelola platform.</li>
        <li>Pilihan tema terang atau gelap disimpan di peramban Anda.</li>
        <li>Tidak ada cookie atau skrip analitik, iklan, atau pelacakan pihak ketiga.</li>
      </ul>

      <h2>7. Keamanan</h2>
      <ul>
        <li>Koneksi ke aplikasi memakai HTTPS.</li>
        <li>Kata sandi disimpan sebagai hash bcrypt; mengganti atau mengatur ulang kata sandi mengakhiri semua sesi lama.</li>
        <li>Data setiap klub dipisahkan di tingkat basis data dengan row level security, sesuai peran pengguna.</li>
        <li>Percobaan login dibatasi dan akun dikunci sementara setelah beberapa kali gagal.</li>
        <li>Akses tim pengelola platform wajib memakai verifikasi dua langkah, dan tindakan penting tercatat di log audit yang tidak dapat diubah.</li>
      </ul>
      <p>Tidak ada sistem yang sepenuhnya bebas risiko. Kami terus memperbaiki keamanan aplikasi.</p>

      <h2>8. Masa penyimpanan</h2>
      <ul>
        <li>Data disimpan selama langganan organisasi berjalan.</li>
        <li>Saat langganan berakhir, ditangguhkan, atau dibatalkan, akses klub dibatasi tetapi data tetap tersimpan.</li>
        <li>Data tidak dihapus otomatis saat langganan berakhir. Pemilik dapat memperpanjang langganan kapan saja untuk melanjutkan pemakaian dengan data yang sama.</li>
        <li>Pemilik dapat meminta ekspor atau penghapusan data klub kapan saja. Catatan keuangan dapat disimpan dalam bentuk tanpa identitas bila diwajibkan peraturan.</li>
        <li>Anggota yang dianonimkan kehilangan nama, kontak, alamat, catatan, dan akun loginnya; catatan keuangan dan kehadiran tetap ada tanpa identitas.</li>
        <li>Penghitung IP untuk pembatasan login dihapus dalam sekitar satu hari; token verifikasi email dihapus setelah dipakai.</li>
      </ul>

      <h2>9. Hak Anda</h2>
      <p className="ringkas">Ringkasnya: Anda berhak melihat, membetulkan, mengunduh, dan meminta penghapusan data Anda.</p>
      <ul>
        <li>Mendapat informasi tentang pemrosesan data Anda (kebijakan ini).</li>
        <li>Mengakses dan mengunduh salinan data: anggota yang punya akun dapat mengunduh datanya (JSON) dari portal anggota; admin klub dapat mengunduh data seorang anggota.</li>
        <li>Membetulkan data yang salah melalui admin klub atau halaman profil Anda.</li>
        <li>Meminta penghapusan atau anonimisasi data, dan menarik persetujuan. Penarikan persetujuan tidak memengaruhi pemrosesan yang sudah dilakukan sebelumnya.</li>
        <li>Menolak atau meminta pembatasan pemrosesan dalam hal yang diatur peraturan perundang-undangan.</li>
      </ul>
      <p>
        Kami dapat meminta bukti identitas sebelum memproses permintaan dan akan menanggapinya dalam jangka waktu yang
        ditentukan peraturan. Bila Anda tidak puas dengan tanggapan kami, Anda dapat mengadu kepada lembaga yang
        berwenang di bidang pelindungan data pribadi.
      </p>

      <h2>10. Bila terjadi kegagalan pelindungan data</h2>
      <p>
        Bila terjadi kegagalan pelindungan data pribadi, kami akan memberi tahu klub yang terdampak dan, bila menjadi
        kewajiban kami, subjek data serta lembaga yang berwenang dalam batas waktu yang ditentukan UU Pelindungan Data
        Pribadi. Pemberitahuan memuat data yang terdampak, waktu dan cara kejadian, serta langkah penanganan.
      </p>

      <h2>11. Perubahan kebijakan</h2>
      <p>
        Bila kebijakan ini berubah, kami memperbarui versi dan tanggal di halaman ini. Untuk perubahan yang penting, kami
        memberi tahu pemilik organisasi sebelum perubahan berlaku.
      </p>

      <h2>12. Kontak</h2>
      <LegalContact />
    </LegalPage>
  );
}
