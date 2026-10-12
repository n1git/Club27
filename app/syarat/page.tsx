import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { LEGAL_DOMICILE, LEGAL_OPERATORS, LegalContact, LegalPage } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan",
  description: `Syarat dan ketentuan penggunaan ${APP_NAME}.`,
  alternates: { canonical: "/syarat" },
};

const link = "font-medium text-primary underline-offset-4 hover:underline";

export default function TermsPage() {
  return (
    <LegalPage title="Syarat & Ketentuan" updated="12 Oktober 2026">
      <p>
        Syarat & Ketentuan ini adalah perjanjian antara {LEGAL_OPERATORS}, berkedudukan di {LEGAL_DOMICILE}, selaku
        pengelola {APP_NAME} (&ldquo;kami&rdquo;), dan organisasi yang mendaftar beserta pemiliknya (&ldquo;Anda&rdquo;).
        Dengan mendaftar atau memakai {APP_NAME}, Anda menyetujui syarat ini dan{" "}
        <Link href="/privasi" className={link}>Kebijakan Privasi</Link>.
      </p>

      <h2>1. Definisi</h2>
      <ul>
        <li>Organisasi: akun usaha yang dibuat saat pendaftaran, dimiliki oleh pemilik.</li>
        <li>Klub: unit usaha di bawah organisasi yang memakai aplikasi.</li>
        <li>Pengguna internal: pemilik, admin, pelatih, resepsionis, dan keuangan yang aktif.</li>
        <li>Anggota: orang yang terdaftar di klub, termasuk anak, yang dapat diberi akses baca oleh klub.</li>
      </ul>

      <h2>2. Akun dan peran</h2>
      <p className="ringkas">Ringkasnya: Anda bertanggung jawab atas akun dan orang yang Anda beri akses.</p>
      <ul>
        <li>Satu pendaftaran membuat satu organisasi, satu akun pemilik, dan klub pertama. Data pendaftaran harus benar.</li>
        <li>Pemilik dan admin menambahkan staf dengan peran admin, pelatih, resepsionis, atau keuangan. Akses setiap peran dibatasi oleh aplikasi dan basis data.</li>
        <li>Satu email hanya dapat dipakai untuk satu jenis akun (pemilik, staf, atau anggota).</li>
        <li>Anda wajib menjaga kerahasiaan kata sandi dan segera memberi tahu kami bila ada akses yang tidak sah.</li>
      </ul>

      <h2>3. Kewajiban klub</h2>
      <ul>
        <li>Klub adalah pengendali data anggota dan stafnya, dan bertanggung jawab atas kebenaran serta keabsahan data yang dimasukkannya.</li>
        <li>Klub wajib memperoleh persetujuan anggota, dan untuk anggota di bawah 18 tahun persetujuan orang tua atau wali, sebelum mencatat datanya.</li>
        <li>Klub wajib menanggapi permintaan anggota atas datanya, dengan bantuan fitur ekspor dan anonimisasi di aplikasi.</li>
        <li>Pembayaran dari anggota ke klub dicatat manual oleh klub. {APP_NAME} tidak menerima, menyimpan, atau menyalurkan uang anggota.</li>
      </ul>

      <h2>4. Penggunaan yang dilarang</h2>
      <ul>
        <li>Memasukkan data orang lain tanpa dasar yang sah, atau data yang melanggar hukum.</li>
        <li>Mencoba mengakses data klub lain, menguji celah keamanan tanpa izin tertulis, atau mengganggu kinerja layanan.</li>
        <li>Membagikan akun kepada orang lain atau menjual kembali layanan tanpa persetujuan kami.</li>
        <li>Memakai layanan untuk penipuan, spam, atau kegiatan yang melanggar peraturan perundang-undangan.</li>
      </ul>

      <h2>5. Langganan, trial, dan pembayaran</h2>
      <p className="ringkas">Ringkasnya: harga per pengguna internal, dibayar di luar aplikasi, tanpa perpanjangan otomatis.</p>
      <ul>
        <li>Harga dihitung per pengguna internal sesuai paket dan periode (bulanan atau tahunan) yang tertera di halaman harga saat pemesanan.</li>
        <li>Masa trial, batas klub, dan potongan tahunan mengikuti paket yang berlaku saat pendaftaran.</li>
        <li>Pembayaran dilakukan di luar aplikasi. Paket diaktifkan oleh kami setelah pembayaran diterima.</li>
        <li>Langganan tidak ditagih otomatis. Untuk melanjutkan, ajukan perpanjangan di halaman Langganan dan selesaikan pembayaran; periode baru dimulai setelah periode berjalan habis. Pengingat dikirim 7 hari dan 1 hari sebelum berakhir.</li>
        <li>Biaya untuk periode yang sudah berjalan tidak dikembalikan, kecuali terjadi kesalahan tagihan dari pihak kami atau layanan tidak dapat kami berikan.</li>
        <li>Perubahan harga diberitahukan paling lambat 30 hari sebelumnya dan berlaku untuk periode berikutnya.</li>
      </ul>

      <h2>6. Penangguhan dan pengakhiran</h2>
      <ul>
        <li>Bila langganan belum aktif, atau periode maupun trial berakhir tanpa perpanjangan, akses klub dikunci untuk semua pengguna. Pemilik tetap dapat masuk ke halaman Langganan untuk memperpanjang, dan data tetap tersimpan.</li>
        <li>Kami dapat menangguhkan layanan bila langganan tidak dibayar atau terjadi pelanggaran berat terhadap syarat ini, dengan pemberitahuan lebih dulu kecuali diperlukan segera untuk mencegah kerugian.</li>
        <li>Anda dapat mengakhiri langganan kapan saja dengan menghubungi kami.</li>
        <li>Penangguhan dan pengakhiran menonaktifkan akses ke klub tanpa menghapus data.</li>
      </ul>

      <h2>7. Data Anda dan ekspor</h2>
      <ul>
        <li>Data yang dimasukkan klub tetap milik klub. Kami tidak memakainya selain untuk menjalankan layanan.</li>
        <li>Data tetap tersimpan setelah langganan berakhir, sehingga Anda dapat memperpanjang dan melanjutkan pemakaian. Anda dapat meminta salinan atau penghapusan data klub kapan saja.</li>
      </ul>

      <h2 id="pemrosesan-data">8. Pemrosesan data atas nama klub</h2>
      <p className="ringkas">Ringkasnya: kami memproses data anggota hanya sesuai instruksi klub dan menjaganya tetap rahasia.</p>
      <ul>
        <li>Objek: data anggota, staf, dan kegiatan klub yang dimasukkan ke aplikasi, untuk tujuan menjalankan fitur aplikasi selama langganan berlaku.</li>
        <li>Instruksi: pemakaian fitur aplikasi oleh klub adalah instruksi pemrosesan. Kami tidak memproses data untuk tujuan lain.</li>
        <li>Kerahasiaan: hanya pengelola yang memerlukan akses yang dapat mengakses data, dan mereka terikat kewajiban kerahasiaan.</li>
        <li>Sub-prosesor: penyedia yang tercantum di Kebijakan Privasi. Kami memberi tahu klub sebelum menambah atau mengganti sub-prosesor.</li>
        <li>Keamanan: langkah keamanan sebagaimana dijelaskan di Kebijakan Privasi.</li>
        <li>Bantuan: kami membantu klub menanggapi permintaan subjek data dan memberi tahu klub bila terjadi kegagalan pelindungan data tanpa penundaan yang tidak wajar.</li>
        <li>Pengakhiran: data tetap disimpan sampai klub meminta ekspor atau penghapusan, sebagaimana bagian 7.</li>
        <li>Klub dapat meminta keterangan tertulis tentang kepatuhan kami terhadap bagian ini.</li>
      </ul>

      <h2>9. Ketersediaan layanan</h2>
      <p>
        Kami berupaya menjaga layanan tetap tersedia, tetapi tidak menjanjikan tingkat ketersediaan tertentu. Layanan dapat
        terganggu karena pemeliharaan atau gangguan pada penyedia layanan. Pemeliharaan terencana diberitahukan bila
        memungkinkan.
      </p>

      <h2>10. Tanggung jawab</h2>
      <ul>
        <li>Kami bertanggung jawab atas kerugian langsung yang timbul karena kesalahan kami dalam menyediakan layanan.</li>
        <li>Untuk kerugian selain akibat kesengajaan atau kelalaian berat kami, total tanggung jawab kami dibatasi sebesar biaya langganan yang Anda bayar dalam 12 bulan terakhir.</li>
        <li>Kami tidak bertanggung jawab atas data yang salah dimasukkan klub, atau atas transaksi antara klub dan anggotanya.</li>
        <li>Batasan ini tidak mengurangi hak yang dijamin peraturan perundang-undangan, termasuk UU Perlindungan Konsumen.</li>
      </ul>

      <h2>11. Hukum dan penyelesaian sengketa</h2>
      <p>
        Syarat ini tunduk pada hukum Republik Indonesia. Sengketa diselesaikan lebih dulu secara musyawarah dalam 30 hari
        sejak salah satu pihak memberi tahu secara tertulis. Bila tidak tercapai, sengketa diselesaikan melalui Pengadilan
        Negeri Semarang, tanpa mengurangi hak konsumen untuk menempuh penyelesaian melalui Badan Penyelesaian Sengketa
        Konsumen.
      </p>

      <h2>12. Perubahan syarat</h2>
      <p>
        Kami dapat mengubah syarat ini. Perubahan penting diberitahukan kepada pemilik organisasi paling lambat 14 hari
        sebelum berlaku. Bila Anda tidak setuju, Anda dapat mengakhiri langganan sebelum perubahan berlaku.
      </p>

      <h2>13. Kontak</h2>
      <LegalContact />
    </LegalPage>
  );
}
