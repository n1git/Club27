import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LEGAL_DOMICILE, LEGAL_OPERATORS, LegalContact, LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: `Syarat dan ketentuan penggunaan ${APP_NAME}.`,
  alternates: { canonical: "/syarat" },
};

const link = "font-medium text-accent-foreground underline-offset-4 hover:underline";

export default function TermsPage() {
  return (
    <LegalPage title="Syarat & Ketentuan" updated="12 Oktober 2026">
      <p>
        Syarat & Ketentuan ini adalah perjanjian antara {LEGAL_OPERATORS}, berkedudukan di {LEGAL_DOMICILE}, selaku
        pengelola {APP_NAME} (&ldquo;kami&rdquo;), dan organisasi yang mendaftar beserta pemiliknya (&ldquo;Anda&rdquo;).
        Dengan mendaftar atau memakai {APP_NAME}, Anda menyetujui syarat ini dan{" "}
        <Link href="/privasi" className={link}>Kebijakan Privasi</Link>.
      </p>

      <h2>1. Akun</h2>
      <ul>
        <li>Data pendaftaran harus benar dan lengkap.</li>
        <li>Anda wajib menjaga kerahasiaan kata sandi dan segera memberi tahu kami bila ada akses yang tidak sah.</li>
        <li>Anda bertanggung jawab atas staf yang Anda beri akses dan tindakan yang dilakukan dengan akun mereka.</li>
      </ul>

      <h2>2. Kewajiban klub</h2>
      <ul>
        <li>Klub bertanggung jawab atas kebenaran dan keabsahan data yang dimasukkannya.</li>
        <li>Klub wajib memperoleh persetujuan anggota, atau orang tua/wali untuk anggota di bawah 18 tahun, sebelum mencatat datanya.</li>
        <li>Klub wajib menanggapi permintaan anggota atas datanya.</li>
        <li>{APP_NAME} tidak menerima, menyimpan, atau menyalurkan uang anggota klub.</li>
      </ul>

      <h2>3. Penggunaan yang dilarang</h2>
      <ul>
        <li>Memasukkan data orang lain tanpa dasar yang sah atau data yang melanggar hukum.</li>
        <li>Mencoba mengakses data klub lain atau mengganggu layanan.</li>
        <li>Membagikan akun atau menjual kembali layanan tanpa persetujuan kami.</li>
        <li>Memakai layanan untuk penipuan, spam, atau kegiatan yang melanggar hukum.</li>
      </ul>

      <h2>4. Langganan dan pembayaran</h2>
      <ul>
        <li>Harga, masa trial, dan batas klub mengikuti paket yang tertera di halaman harga saat pemesanan.</li>
        <li>Pembayaran dilakukan melalui penyedia pembayaran resmi atau transfer. Paket aktif setelah pembayaran terkonfirmasi.</li>
        <li>Langganan tidak ditagih otomatis. Untuk melanjutkan, ajukan perpanjangan dan selesaikan pembayaran sebelum periode berakhir.</li>
        <li>Biaya periode yang sudah berjalan tidak dikembalikan, kecuali terjadi kesalahan tagihan dari pihak kami atau layanan tidak dapat kami berikan.</li>
        <li>Perubahan harga diberitahukan paling lambat 30 hari sebelumnya dan berlaku untuk periode berikutnya.</li>
      </ul>

      <h2>5. Penangguhan dan pengakhiran</h2>
      <ul>
        <li>Bila langganan belum aktif atau berakhir tanpa perpanjangan, akses klub dikunci sampai langganan diperpanjang.</li>
        <li>Kami dapat menangguhkan layanan bila terjadi pelanggaran berat terhadap syarat ini, dengan pemberitahuan lebih dulu kecuali diperlukan segera untuk mencegah kerugian.</li>
        <li>Anda dapat mengakhiri langganan kapan saja dengan menghubungi kami.</li>
      </ul>

      <h2 id="pemrosesan-data">6. Data klub</h2>
      <ul>
        <li>Data yang dimasukkan klub tetap milik klub. Kami memprosesnya hanya untuk menjalankan layanan bagi klub.</li>
        <li>Data tetap tersimpan setelah langganan berakhir. Anda dapat meminta salinan atau penghapusan data klub kapan saja.</li>
        <li>Hanya pihak kami yang memerlukan akses yang dapat mengakses data, dan mereka terikat kewajiban kerahasiaan.</li>
        <li>Kami membantu klub menanggapi permintaan anggota atas datanya dan memberi tahu klub bila terjadi kegagalan pelindungan data.</li>
      </ul>

      <h2>7. Ketersediaan layanan</h2>
      <p>
        Kami berupaya menjaga layanan tetap tersedia, tetapi tidak menjamin layanan bebas gangguan. Pemeliharaan
        terencana diberitahukan bila memungkinkan.
      </p>

      <h2>8. Tanggung jawab</h2>
      <ul>
        <li>Kami bertanggung jawab atas kerugian langsung yang timbul karena kesalahan kami.</li>
        <li>Kecuali karena kesengajaan atau kelalaian berat, tanggung jawab kami dibatasi sebesar biaya langganan yang Anda bayar dalam 12 bulan terakhir.</li>
        <li>Kami tidak bertanggung jawab atas data yang salah dimasukkan klub atau transaksi antara klub dan anggotanya.</li>
        <li>Batasan ini tidak mengurangi hak yang dijamin peraturan perundang-undangan.</li>
      </ul>

      <h2>9. Hukum dan sengketa</h2>
      <p>
        Syarat ini tunduk pada hukum Republik Indonesia. Sengketa diselesaikan lebih dulu secara musyawarah dalam 30 hari.
        Bila tidak tercapai, sengketa diselesaikan melalui Pengadilan Negeri Semarang, tanpa mengurangi hak konsumen untuk
        menempuh Badan Penyelesaian Sengketa Konsumen.
      </p>

      <h2>10. Perubahan syarat</h2>
      <p>
        Perubahan penting diberitahukan kepada pemilik organisasi paling lambat 14 hari sebelum berlaku. Bila tidak
        setuju, Anda dapat mengakhiri langganan sebelum perubahan berlaku.
      </p>

      <h2>11. Kontak</h2>
      <LegalContact />
    </LegalPage>
  );
}
