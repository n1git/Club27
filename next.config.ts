import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

const MOVED_PATHS: [string, string][] = [
  ["/daftar/akun", "/signup/account"],
  ["/daftar", "/signup"],
  ["/lupa-sandi", "/forgot-password"],
  ["/atur-ulang-sandi", "/reset-password"],
  ["/atur-ulang-sandi/:token", "/reset-password/:token"],
  ["/undangan", "/invite"],
  ["/undangan/:token", "/invite/:token"],
  ["/privasi", "/privacy"],
  ["/syarat", "/terms"],
  ["/olahraga", "/sports"],
  ["/olahraga/:code", "/sports/:code"],
  ["/akun/profil", "/profile"],
  ["/akun/teman", "/home/friends"],
  ["/akun/grup", "/home/groups"],
  ["/akun/grup/:id", "/home/groups/:id"],
  ["/akun/latihan", "/home/workouts"],
  ["/akun/klub", "/home/join-club"],
  ["/akun/upgrade", "/home/upgrade"],
  ["/akun/pengaturan", "/home/settings"],
  ["/akun", "/home"],
  ["/admin/fasilitas", "/admin/facilities"],
  ["/admin/kasir", "/admin/pos"],
  ["/admin/pesanan", "/admin/orders"],
  ["/admin/pesanan/:id", "/admin/orders/:id"],
  ["/admin/produk", "/admin/products"],
  ["/admin/peran", "/admin/roles"],
  ["/admin/permintaan-gabung", "/admin/join-requests"],
  ["/admin/klub/langganan", "/admin/club/subscription"],
  ["/admin/klub/pemilik", "/admin/club/owners"],
  ["/admin/klub/ekspor", "/admin/club/export"],
  ["/admin/klub/hapus", "/admin/club/delete"],
  ["/admin/klub", "/admin/club"],
  ["/admin/checkin/layar", "/admin/checkin/screen"],
  ["/admin/checkin/layar/:pointId", "/admin/checkin/screen/:pointId"],
  ["/admin/settings/modul", "/admin/settings/modules"],
  ["/admin/profile", "/profile"],
  ["/coach/profile", "/profile"],
  ["/member/profile", "/profile"],
  ["/member/pesanan", "/member/orders"],
  ["/member/kunjungan", "/member/visits"],
  ["/member/klub", "/member/clubs"],
  ["/superadmin/laporan", "/superadmin/reports"],
];

const nextConfig: NextConfig = {
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
    staleTimes: { dynamic: 60, static: 60 },
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return MOVED_PATHS.map(([source, destination]) => ({ source, destination, permanent: true }));
  },
};

export default nextConfig;
