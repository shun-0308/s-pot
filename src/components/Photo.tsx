"use client";

import type { RecordWithPhotos } from "@/lib/records";

// 写真があれば全幅・角なしで表示、なければ控えめなプレースホルダ
export default function Photo({
  rec,
  h = 200,
  w = "100%",
}: {
  rec: RecordWithPhotos;
  h?: number;
  w?: number | string;
}) {
  const url = rec.photos[0]?.url;
  if (url)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={rec.name}
        style={{ width: w, height: h, objectFit: "cover", display: "block" }} />
    );
  return (
    <div style={{ width: w, height: h, display: "flex", alignItems: "center",
      justifyContent: "center", background: "#E8E4D8",
      color: "#9A9183", fontSize: 10, letterSpacing: "0.3em" }}>
      NO PHOTO
    </div>
  );
}
