import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./workspace-theme.css";
import "./landing.css";
import { Providers } from "@/components/providers";
const inter = localFont({
  src: "../public/fonts/inter.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Arsip GS · Pertamina Retail",
  description:
    "Ruang kerja pengelolaan arsip dan pengajuan FUPA Pertamina Retail. Lingkungan lokal demonstrasi.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
