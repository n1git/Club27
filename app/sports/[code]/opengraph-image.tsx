import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { APP_NAME } from "@/lib/config";
import { getPublicClubTypes } from "@/lib/club-type";
import { sportContent } from "@/components/landing/sport-content";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `Aplikasi manajemen klub olahraga di ${APP_NAME}`;

export default async function SportOpenGraphImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const type = (await getPublicClubTypes()).find((t) => t.code === code && t.status === "ready");
  const name = type?.name ?? "Klub olahraga";
  const tagline = type ? sportContent(type, (m) => type.modules.includes(m)).tagline : "Satu aplikasi untuk mengelola klub olahraga.";
  const logo = await readFile(join(process.cwd(), "public/brand/ruzz-italic-lockup-black-transparent.svg"), "base64");
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
          background: "#111214",
          color: "#f2f2ee",
        }}
      >
        <img src={`data:image/svg+xml;base64,${logo}`} alt="" width={424} height={96} />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 30, color: "#ffd21f", fontWeight: 700 }}>Aplikasi manajemen</div>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05, maxWidth: 1000 }}>{name}</div>
          <div style={{ fontSize: 32, color: "#a6a7ab", maxWidth: 1000 }}>{tagline}</div>
        </div>
      </div>
    ),
    size
  );
}
