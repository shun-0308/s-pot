"use client";

import { useState } from "react";
import { toggleFavorite } from "@/lib/favorites";

type Props = {
  recordId: string;
  initialFav: boolean;
  size?: number;
  onToggle?: (isFav: boolean) => void; // 親のstateと同期するコールバック(任意)
};

export default function FavoriteButton({ recordId, initialFav, size = 20, onToggle }: Props) {
  const [fav, setFav] = useState(initialFav);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const next = await toggleFavorite(recordId, fav);
      setFav(next);
      onToggle?.(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      title={fav ? "お気に入りを解除" : "お気に入りに追加"}
      style={{
        background: "none",
        border: "none",
        cursor: busy ? "default" : "pointer",
        padding: 4,
        lineHeight: 1,
        opacity: busy ? 0.5 : 1,
        transition: "opacity 0.15s, transform 0.15s",
        transform: busy ? "scale(0.9)" : "scale(1)",
        flexShrink: 0,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill={fav ? "var(--shu, #B23A24)" : "none"}
        stroke={fav ? "var(--shu, #B23A24)" : "var(--ink-faint, #7A786F)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 17.5S2 12.5 2 6.5a4 4 0 0 1 8-1.08A4 4 0 0 1 18 6.5c0 6-8 11-8 11z" />
      </svg>
    </button>
  );
}
