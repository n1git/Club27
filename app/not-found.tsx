import type { Metadata } from "next";
import { StatusPage } from "@/components/shared/status-page";

export const metadata: Metadata = { title: "Halaman tidak ditemukan", robots: { index: false } };

export default function NotFound() {
  return (
    <StatusPage
      title="Halaman tidak ditemukan"
      description="Alamat yang Anda buka tidak ada atau sudah dipindahkan. Periksa kembali alamatnya, atau mulai dari beranda."
    />
  );
}
