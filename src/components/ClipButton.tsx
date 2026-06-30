"use client";

import { useEffect, useState } from "react";

// クリップ(行きたい場所の保存)ボタン。♡(FavoriteButton)と並べて使う。
// しおりの旗(ブックマーク)アイコン。クリップ中は金色で塗る。
type Props = {
  clipped: boolean;
  size?: number;
  busy?: boolean;
  onToggle: (next: boolean) => void; // 楽観更新の責務は親(page)に置く
};

export default function ClipButton({ clipped, size = 20, busy = false, onToggle }: Props) {
  const [on, setOn] = useState(clipped);
  useEffect(() => setOn(clipped), [clipped]);

  const handle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (busy) return;
    const next = !on;
    setOn(next);
    onToggle(next);
  };

  return (
    <button
      onClick={handle}
      disabled={busy}
      title={on ? "クリップを外す" : "行きたい場所にクリップ"}
      style={{
        background: "none", border: "none", cursor: busy ? "default" : "pointer",
        padding: 4, lineHeight: 1, opacity: busy ? 0.5 : 1, flexShrink: 0,
        transition: "opacity .15s, transform .15s", transform: busy ? "scale(0.9)" : "scale(1)",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 20 20"
        fill={on ? "#C9A86A" : "none"}
        stroke={on ? "#C9A86A" : "var(--ink-faint, #7A786F)"}
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 3.5h10a1 1 0 0 1 1 1V17l-6-3.2L4 17V4.5a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
