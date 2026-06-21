"use client";

import { useState } from "react";
import { PREFECTURES, PREF_EN, regionColor, type Prefecture } from "@/lib/prefectures";
import { projGeo } from "@/lib/geo";

type Props = {
  /** 県コード → 記録数 */
  counts: Record<number, number>;
  onSelect?: (pref: Prefecture) => void;
};

// 緯度経度グリッド(海図風)
const LONS = [130, 135, 140, 145];
const LATS = [32, 36, 40, 44];

// 衛星ダーク: 実際の衛星写真(投影一致でクロップ済み)を下敷きにした夜の海図
export default function JapanMap({ counts, onSelect }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover != null ? PREFECTURES.find((q) => q.id === hover) : null;

  const enter = (p: Prefecture, e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setHover(p.id);
  };
  const up = (p: Prefecture, e: React.PointerEvent) => {
    if (e.pointerType === "touch") setHover(p.id); // ラベルを一瞬表示
    onSelect?.(p);
  };

  return (
    <svg viewBox="0 0 760 865" style={{ width: "100%", display: "block" }}>
      <defs>
        {/* 角を丸くして写真の硬い四角を和らげる */}
        <clipPath id="mapRound"><rect x="0" y="0" width="760" height="865" rx="24" ry="24" /></clipPath>
        {/* 周辺をそっと落とすビネット(枠線に頼らず縁をやわらげる) */}
        <radialGradient id="mapVignette" cx="50%" cy="47%" r="74%">
          <stop offset="60%" stopColor="#0A2233" stopOpacity="0" />
          <stop offset="100%" stopColor="#0A2233" stopOpacity="0.34" />
        </radialGradient>
      </defs>

      <g clipPath="url(#mapRound)">
        {/* 衛星写真(lon 128.6–146.2 / lat 30–45.8 を投影どおりに引き伸ばし) */}
        <image href="/textures/japan-satellite.jpg" x="0" y="0" width="760" height="865" preserveAspectRatio="none" />
        {/* 沖縄インセットの下地(すりガラス風。背後の大陸をうっすら残す) */}
        <rect x="0" y="0" width="165" height="215" fill="#0A2A4A" opacity="0.82" />
        <path d="M 18 215 L 165 215 L 165 320" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" strokeDasharray="4 4" />

        {/* 緯度経度グリッド(海図のなごり・控えめに) */}
        {LONS.map((lon) => {
          const x = projGeo(lon, 38)[0];
          return (
            <g key={"lon" + lon}>
              <line x1={x} y1="0" x2={x} y2="865" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
              <text x={x + 5} y="858" fontSize="9" fill="#D5ECF4" opacity="0.7" letterSpacing="1.5">{lon}°E</text>
            </g>
          );
        })}
        {LATS.map((lat) => {
          const y = projGeo(135, lat)[1];
          return (
            <g key={"lat" + lat}>
              <line x1="0" y1={y} x2="760" y2={y} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
              <text x="8" y={y - 5} fontSize="9" fill="#D5ECF4" opacity="0.7" letterSpacing="1.5">{lat}°N</text>
            </g>
          );
        })}

        {PREFECTURES.map((p) => {
        const has = (counts[p.id] ?? 0) > 0;
        const isHover = hover === p.id;
        return (
          <path
            key={p.id}
            className={has ? "pref-path atlas-visited" : "pref-path"}
            d={p.d}
            fill={has ? regionColor(p.id) : isHover ? "rgba(255,255,255,0.3)" : "rgba(5,18,30,0.5)"}
            fillOpacity={has ? 0.9 : 1}
            stroke={has ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.4)"}
            strokeWidth={isHover ? 1.5 : 0.7}
            onPointerEnter={(e) => enter(p, e)}
            onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null); }}
            onPointerUp={(e) => up(p, e)}
          />
        );
      })}

      {/* 訪問県のスタンプバッジ */}
      {PREFECTURES.filter((p) => (counts[p.id] ?? 0) > 0).map((p) => (
        <g key={"b" + p.id} pointerEvents="none">
          <circle cx={p.cx} cy={p.cy} r="10.5" fill="#9A7B5F" opacity="0.94" />
          <text x={p.cx} y={p.cy + 3.5} textAnchor="middle" fill="#F7F5EF" fontSize="10.5" fontWeight="700">
            {counts[p.id]}
          </text>
        </g>
      ))}

      {/* 照準カーソル(地球と同じ線状リティクル) */}
      {hovered && (() => {
        const p = hovered;
        const cnt = counts[p.id] ?? 0;
        const right = p.cx < 540;
        const upDir = p.cy > 140;
        const ex = p.cx + (right ? 46 : -46);
        const ey = p.cy + (upDir ? -46 : 46);
        const lx = ex + (right ? 92 : -92);
        const ink = "#E8EFF5";
        return (
          <g pointerEvents="none">
            <circle cx={p.cx} cy={p.cy} r="4" fill="none" stroke={ink} strokeWidth="1.1" />
            <path d={`M ${p.cx - 12} ${p.cy} H ${p.cx - 6} M ${p.cx + 6} ${p.cy} H ${p.cx + 12} M ${p.cx} ${p.cy - 12} V ${p.cy - 6} M ${p.cx} ${p.cy + 6} V ${p.cy + 12}`}
              stroke={ink} strokeWidth="1.1" />
            <path d={`M ${p.cx} ${p.cy} L ${ex} ${ey} L ${lx} ${ey}`} fill="none" stroke={ink} strokeWidth="1.1" />
            <text x={ex + (right ? 4 : -4)} y={ey - 8} textAnchor={right ? "start" : "end"}
              fill={ink} fontSize="13" fontWeight="700" letterSpacing="3">
              {PREF_EN[p.id]}
            </text>
            <text x={ex + (right ? 4 : -4)} y={ey + 15} textAnchor={right ? "start" : "end"}
              fill={cnt ? "#FFD9C9" : "#DFF0F6"} fontSize="10" letterSpacing="2">
              {cnt ? `${cnt} RECORDS — ${p.name}` : `NO RECORDS — ${p.name}`}
            </text>
          </g>
        );
      })()}

        {/* ビネット(縁をそっと落とす) */}
        <rect x="0" y="0" width="760" height="865" fill="url(#mapVignette)" pointerEvents="none" />
      </g>

      {/* やわらかな縁取り+図名(硬い外枠と四隅ティックは廃止) */}
      <rect x="1.5" y="1.5" width="757" height="862" rx="22.5" ry="22.5"
        fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.2" />
      <text x="30" y="846" fontSize="10" fill="#E2F2F8" opacity="0.72" letterSpacing="3">JAPAN — MY TRAVEL ATLAS</text>
    </svg>
  );
}
