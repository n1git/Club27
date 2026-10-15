import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import { APP_NAME } from "@/lib/config";
import { SITE_URL } from "@/lib/site";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { LazyToaster } from "@/components/shared/lazy-toaster";
import "./globals.css";

const display = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["800"],
  style: ["italic"],
  variable: "--nf-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--nf-sans",
});

const DESCRIPTION =
  "Satu aplikasi untuk mengelola klub olahraga: anggota, jadwal dan booking fasilitas, tagihan, kasir, dan buku kas.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  openGraph: { type: "website", locale: "id_ID", siteName: APP_NAME, title: APP_NAME, description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: APP_NAME, description: DESCRIPTION },
};

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="id"
      className={`h-full antialiased ${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider nonce={nonce}>
          {children}
          <LazyToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
