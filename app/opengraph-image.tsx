import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";

export const alt = `${APP_NAME}: satu aplikasi untuk mengelola klub olahraga`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo-a-on-dark.svg"), "base64");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0e0e0e",
          color: "#f2f2ee",
        }}
      >
        <img src={`data:image/svg+xml;base64,${logo}`} alt="" width={294} height={150} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>
            Satu aplikasi untuk mengelola semua klub olahraga Anda.
          </div>
          <div style={{ fontSize: 30, color: "#a6a69e" }}>
            Anggota · Jadwal & booking fasilitas · Tagihan · Kasir · Buku kas
          </div>
        </div>
      </div>
    ),
    size
  );
}
