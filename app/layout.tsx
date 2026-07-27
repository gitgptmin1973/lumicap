import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lumicap-chatgpt-app.minopro.workers.dev"),
  title: "LUMICAP — Capture. Explain. Ship.",
  description:
    "スクリーンショット、録画、注釈、OCR、共有、AIタスク化をひとつにまとめたマルチデバイス対応PWA。",
  icons: {
    icon: "/studio/icon-192.png",
    apple: "/studio/icon-192.png",
  },
  openGraph: {
    title: "LUMICAP — 撮る。整える。キーで速く。",
    description:
      "画面キャプチャ、録画、注釈、手順書、AIタスクをキーボードで高速操作。",
    type: "website",
    images: [{ url: "/og.png", width: 1672, height: 941, alt: "LUMICAP StudioとCtrl+Shift+1ショートカット" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LUMICAP — 撮る。整える。キーで速く。",
    description: "ローカルファーストの画面キャプチャPWA。",
    images: ["/og.png"],
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
