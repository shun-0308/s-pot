import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "S-pot — 旅の図鑑",
  description:
    "日本地図から県をタップして、自分が撮った写真と記録文が読める自分だけの観光図鑑。",
  applicationName: "S-pot",
  appleWebApp: {
    capable: true,
    title: "S-pot",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // 入力時の意図しないズームを防ぐ
  viewportFit: "cover", // ノッチ/ホームバーまで使う(safe-area対応)
  themeColor: "#EFE7D6",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
