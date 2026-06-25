"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
};

const GOLD = "#C9A86A";
const GOLD_SOFT = "#E3C58C";
const V = 268;   // 表示ビューポート(正方形)
const OUT = 512; // 出力サイズ

// 顔写真を丸く切り抜くためのエディタ。ドラッグで位置合わせ・スライダーで拡大。
export default function AvatarCropper({ file, onCancel, onDone }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);          // cover基準の倍率(1〜3)
  const [off, setOff] = useState({ x: 0, y: 0 }); // 画像左上のビューポート内座標
  const coverRef = useRef(1);                    // ビューポートを覆う最小スケール
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // 画像読み込み
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const cover = Math.max(V / im.naturalWidth, V / im.naturalHeight);
      coverRef.current = cover;
      const dw = im.naturalWidth * cover;
      const dh = im.naturalHeight * cover;
      setImg(im);
      setZoom(1);
      setOff({ x: (V - dw) / 2, y: (V - dh) / 2 });
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const eff = () => coverRef.current * zoom; // 実効スケール
  const dims = () => {
    if (!img) return { dw: V, dh: V };
    const s = eff();
    return { dw: img.naturalWidth * s, dh: img.naturalHeight * s };
  };

  // 画像がビューポートを必ず覆うように位置を制限
  const clamp = (x: number, y: number) => {
    const { dw, dh } = dims();
    return {
      x: Math.min(0, Math.max(V - dw, x)),
      y: Math.min(0, Math.max(V - dh, y)),
    };
  };

  // ズーム変更時、中心を保ったまま拡縮
  const changeZoom = (z: number) => {
    const old = eff();
    const cx = (V / 2 - off.x) / old; // 画像座標での中心
    const cy = (V / 2 - off.y) / old;
    const next = coverRef.current * z;
    const nx = V / 2 - cx * next;
    const ny = V / 2 - cy * next;
    setZoom(z);
    setOff(clamp(nx, ny));
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOff(clamp(nx, ny));
  };
  const onUp = () => { drag.current = null; };

  // 切り抜いて512pxのJPEGを書き出す
  const confirm = () => {
    if (!img) return;
    const s = eff();
    const srcSize = V / s;           // ビューポートが映す画像領域(正方形)
    const sx = -off.x / s;
    const sy = -off.y / s;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUT, OUT);
    canvas.toBlob((b) => { if (b) onDone(b); }, "image/jpeg", 0.9);
  };

  const { dw, dh } = dims();

  return (
    <div
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, zIndex: 120, background: "rgba(5,6,10,0.82)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(360px, 94vw)", background: "linear-gradient(180deg, #1A1D27 0%, #0F1117 100%)",
          border: "1px solid rgba(201,168,106,0.22)", borderRadius: 8, padding: "22px 22px 20px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.3em", color: GOLD, marginBottom: 4 }}>ADJUST PHOTO</div>
        <div className="tz-serif" style={{ fontSize: 17, fontWeight: 700, color: "var(--dark-strong)", marginBottom: 16 }}>
          顔写真の位置を調整
        </div>

        {/* ビューポート(丸いマスク) */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            style={{ position: "relative", width: V, height: V, borderRadius: "50%", overflow: "hidden",
              touchAction: "none", cursor: "grab", background: "#0E0F15",
              boxShadow: `0 0 0 3px #0E0F15, 0 0 0 5px ${GOLD}` }}
          >
            {img && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.src} alt="" draggable={false}
                style={{ position: "absolute", left: off.x, top: off.y, width: dw, height: dh, maxWidth: "none", userSelect: "none", pointerEvents: "none" }} />
            )}
            {/* 中央の目安リング */}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.25)", pointerEvents: "none" }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: "var(--dark-faint)", textAlign: "center", margin: "12px 0 6px" }}>
          ドラッグで位置合わせ・スライダーで拡大
        </div>

        {/* ズーム */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "2px 4px 18px" }}>
          <span style={{ color: GOLD, fontSize: 15 }}>－</span>
          <input type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => changeZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: GOLD }} />
          <span style={{ color: GOLD, fontSize: 17 }}>＋</span>
        </div>

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={onCancel}
            style={{ background: "none", border: "1px solid var(--hairline-dark)", padding: "10px 20px",
              fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", color: "var(--dark-body)", letterSpacing: "0.1em", borderRadius: 2 }}>
            やめる
          </button>
          <button onClick={confirm} disabled={!img}
            style={{ background: `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`, color: "#1A1408", border: "none",
              padding: "10px 26px", fontSize: 12.5, fontWeight: 700, cursor: img ? "pointer" : "default",
              fontFamily: "inherit", letterSpacing: "0.1em", borderRadius: 2, opacity: img ? 1 : 0.5 }}>
            この範囲で決定
          </button>
        </div>
      </div>
    </div>
  );
}
