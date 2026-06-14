import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "S-pot — 旅の図鑑",
    short_name: "S-pot",
    description:
      "日本地図から県をタップして、自分が撮った写真と記録文が読める自分だけの観光図鑑。",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EFE7D6",
    theme_color: "#EFE7D6",
    lang: "ja",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
