import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { pageMetadata } from "@/lib/seo";
import { LEGAL_DOMICILE, LEGAL_OPERATORS, LegalContact, LegalPage } from "@/components/landing/legal-page";
import { PRIVACY_VERSION } from "@/lib/privacy";

export const metadata: Metadata = pageMetadata({
  title: "Kebijakan Privasi",
  description: `Kebijakan privasi ${APP_NAME}: data yang diproses, tujuannya, dan hak Anda.`,
  path: "/privacy",
});

const link = "font-medium text-accent-foreground underline-offset-4 hover:underline";

export default function PrivacyPage() {
  return (
    <LegalPage title="Kebijakan Privasi" updated="21 Oktober 2026">
      <p>
        Kebijakan ini menjelaskan data pribadi yang diproses di {APP_NAME}, tujuannya, dan hak Anda sesuai
        Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Versi {PRIVACY_VERSION}.
      </p>

      <h2>1. Pengelola dan tanggung jawab</h2>
      <p>
        {APP_NAME} dikelola oleh {LEGAL_OPERATORS}, berkedudukan di {LEGAL_DOMICILE} (&ldquo;kami&rdquo;).
      </p>
      <ul>
        <li>Untuk data akun pemilik dan langganan, kami adalah pengendali data.</li>
        <li>
          Untuk data anggota, staf, dan kegiatan klub, klub adalah pengendali data dan kami memprosesnya atas nama klub
          sesuai{" "}
          <Link href="/terms#pemrosesan-data" className={link}>
            Syarat & Ketentuan
          </Link>
          . Permintaan tentang data anggota sebaiknya diajukan lebih dulu kepada klub.
        </li>
      </ul>

      <h2>2. Data yang diproses</h2>
      <ul>
        <li>Data akun pemilik, staf, dan anggota: nama, email, nama pengguna, nomor telepon, dan kata sandi.</li>
        <li>Data anggota yang diisi klub: tanggal lahir, alamat, kontak orang tua atau wali, dan catatan. Anggota dapat berupa anak.</li>
        <li>Data kegiatan klub: jadwal, booking, kehadiran, check-in, paket, tagihan, transaksi kasir, buku kas, dan gaji pelatih.</li>
        <li>
          Data akun pribadi (tanpa organisasi): profil dan username, catatan latihan, catatan kesehatan, teman, postingan, komentar, kudos, grup, dan event.
          Catatan latihan bersifat pribadi. Total latihan (jarak, durasi, jumlah sesi) tampil di peringkat grup bagi sesama anggota
          grup. Di peringkat klub, nama, username, dan total latihan tampil bagi anggota dan admin klub hanya jika Anda mengaktifkannya sendiri, per klub, dan dapat dimatikan kapan saja. Catatan kesehatan (tinggi dan
          berat badan per tanggal) hanya dapat dilihat oleh Anda, tidak ditampilkan ke klub, pelatih, teman, grup, feed, atau
          peringkat, dan dapat dihapus kapan saja.
        </li>
        <li>Catatan persetujuan dan riwayat tindakan penting di aplikasi.</li>
      </ul>
      <p>Data kartu atau rekening pembayaran diproses langsung oleh penyedia pembayaran dan tidak kami simpan.</p>

      <h2>3. Tujuan pemrosesan</h2>
      <ul>
        <li>Menyediakan akun, langganan, dan fitur aplikasi.</li>
        <li>Membantu klub mengelola anggota, kegiatan, dan keuangannya.</li>
        <li>Menampilkan peringkat, kudos, dan kabar latihan kepada teman, sesama anggota grup, atau klub sesuai pengaturan Anda.</li>
        <li>Menjaga keamanan akun dan mencegah penyalahgunaan.</li>
        <li>Memenuhi kewajiban hukum, termasuk pencatatan keuangan.</li>
      </ul>
      <p>Kami tidak menjual data pribadi dan tidak memakainya untuk iklan.</p>

      <h2>4. Data anak</h2>
      <p>
        Anggota di bawah 18 tahun hanya dapat dicatat dengan persetujuan orang tua atau wali. Klub bertanggung jawab
        memperoleh persetujuan tersebut. Orang tua atau wali dapat meminta akses, perbaikan, atau penghapusan data
        anaknya melalui klub atau kontak kami.
      </p>

      <h2>5. Penyedia layanan dan transfer ke luar negeri</h2>
      <p>
        Kami memakai penyedia layanan pihak ketiga untuk menjalankan aplikasi dan memproses pembayaran langganan. Sebagian server penyedia berada di luar
        Indonesia, sehingga data dapat ditransfer ke luar wilayah Indonesia. Kami hanya memilih penyedia dengan standar
        pelindungan data yang memadai dan hanya memberikan data yang diperlukan.
      </p>

      <h2>6. Cookie</h2>
      <p>
        Kami hanya memakai cookie yang diperlukan agar Anda tetap masuk dan pengaturan tampilan tersimpan. Tidak ada
        cookie analitik, iklan, atau pelacakan pihak ketiga.
      </p>

      <h2>7. Keamanan</h2>
      <p>
        Kami menerapkan langkah teknis dan organisasi yang wajar untuk melindungi data dari akses, perubahan, dan
        pengungkapan yang tidak sah. Tidak ada sistem yang sepenuhnya bebas risiko, dan kami terus memperbaiki keamanan
        aplikasi.
      </p>

      <h2>8. Masa penyimpanan</h2>
      <p>
        Data disimpan selama langganan berjalan. Bila langganan berakhir tanpa perpanjangan, data tetap tersimpan dan
        hanya bisa dibaca selama satu tahun; setelah itu organisasi dapat dihapus permanen oleh admin platform
        (penghapusan ini belum berjalan otomatis). Pemilik dapat mengunduh salinan seluruh data organisasi (CSV dalam satu file ZIP) kapan saja dari aplikasi. Pemilik utama dapat menghapus organisasi kapan saja:
        organisasi langsung tidak bisa diakses, dapat dipulihkan dalam 30 hari, lalu data klub di basis data aplikasi
        (anggota, tagihan, penjualan, jadwal, dan log audit) dihapus permanen. Akun login tiap orang tetap ada. Setelah
        penghapusan kami menyimpan catatan nama organisasi, waktu, dan jumlah baris yang dihapus, tanpa data pribadi.
        Catatan keuangan dapat disimpan tanpa identitas bila diwajibkan peraturan.
      </p>

      <h2>9. Hak Anda</h2>
      <ul>
        <li>Mengakses dan memperoleh salinan data Anda.</li>
        <li>Membetulkan data yang tidak akurat.</li>
        <li>Meminta penghapusan data dan menarik persetujuan.</li>
        <li>Menolak atau membatasi pemrosesan sesuai peraturan perundang-undangan.</li>
      </ul>
      <p>
        Ajukan permintaan melalui klub Anda atau kontak kami. Kami dapat meminta verifikasi identitas dan akan menanggapi
        dalam jangka waktu yang ditentukan peraturan.
      </p>

      <h2>10. Kegagalan pelindungan data</h2>
      <p>
        Bila terjadi kegagalan pelindungan data pribadi, kami akan memberi tahu pihak yang terdampak dan lembaga yang
        berwenang sesuai ketentuan UU Pelindungan Data Pribadi.
      </p>

      <h2>11. Perubahan kebijakan</h2>
      <p>
        Perubahan kebijakan ditandai dengan versi dan tanggal baru di halaman ini. Perubahan penting diberitahukan kepada
        pemilik organisasi sebelum berlaku.
      </p>

      <h2>12. Kontak</h2>
      <LegalContact />
    </LegalPage>
  );
}
