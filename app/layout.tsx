import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LUMICAP — Capture. Explain. Ship.",
  description:
    "スクリーンショット、録画、注釈、OCR、共有、AIタスク化をひとつにまとめたマルチデバイス対応PWA。",
  icons: {
    icon: "/studio/icon-192.png",
    apple: "/studio/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
