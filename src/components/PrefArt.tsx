"use client";

import { useEffect, useRef, useState } from "react";
import { mainRingBboxOf, type Prefecture } from "@/lib/prefectures";
import { projGeo } from "@/lib/geo";
import type { Muni } from "@/lib/munis";

type Props = {
  pref: Prefecture;
  // 区に属さない地点(埋め立て島など)のフォールバック点グロー
  orphanPoints?: { id: string; lng: number; lat: number }[];
  // 地図⇔写真の連動(市区町村)
  munis?: Muni[] | null;
  selectedMuni?: string | null; // タップで選択中のコード
  blinkMuni?: string | null;    // 写真ホバーで点滅させるコード
  visitedMunis?: Set<string>;   // 記録のある市区町村(境界に沿って光らせる)
  highlightMuni?: string | null; // カードのクリックで強調する市区町村
  muniCounts?: Record<string, number>; // 市区町村ごとの記録件数(バッジ表示)
  onMuniTap?: (m: Muni) => void;
};

// 県の一枚絵: 古地図色のシルエットに、訪れた場所の地名が手書きで書き込まれていく
// public/maps/{id}.png(AI生成の水彩アート地図)があれば、それを下敷きに使う
export default function PrefArt({ pref, orphanPoints, munis, selectedMuni, blinkMuni, visitedMunis, highlightMuni, muniCounts, onMuniTap }: Props) {
  const [artUrl, setArtUrl] = useState<string | null>(null);
  const [hoverMuni, setHoverMuni] = useState<Muni | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    let alive = true;
    const url = `/maps/${pref.id}.png`;
    const img = new Image();
    img.onload = () => alive && setArtUrl(url);
    img.onerror = () => alive && setArtUrl(null);
    img.src = url;
    return () => { alive = false; };
  }, [pref.id]);

  const bb = mainRingBboxOf(pref.d);
  const pad = Math.max(bb.w, bb.h) * 0.2;
  const vx = bb.minX - pad;
  const vy = bb.minY - pad;
  const vw = bb.w + pad * 2;
  const vh = bb.h + pad * 2;
  const k = Math.max(vw, vh); // 県の大きさに対する相対単位

  // 画面座標 → viewBox座標(照準線カーソル用)。沖縄はインセットのため照準なし
  const interactive = munis != null && pref.id !== 47;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || e.pointerType === "touch") return;
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    setCursor({
      x: vx + ((e.clientX - r.left) / r.width) * vw,
      y: vy + ((e.clientY - r.top) / r.height) * vh,
    });
  };

  return (
    <svg ref={svgRef} viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={{ width: "100%", display: "block", cursor: interactive ? "none" : undefined }}
      onPointerMove={onMove}
      onPointerLeave={() => { setCursor(null); setHoverMuni(null); }}>
      <defs>
        {/* 輪郭を古い紙に染みた墨のように揺らす */}
        <filter id={`wash-${pref.id}`} x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence type="fractalNoise" baseFrequency={10 / k} numOctaves="3" seed={pref.id} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={k * 0.02} />
        </filter>
        {/* 達成スポットの温かい光(中心が明るく外へ溶ける) */}
        <radialGradient id={`spotGlow-${pref.id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE7B0" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#F4C27A" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F4C27A" stopOpacity="0" />
        </radialGradient>
        {/* 光のにじみ(グロー) */}
        <filter id={`bloom-${pref.id}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={k * 0.012} />
        </filter>
      </defs>

      {/* 水彩アート地図(あれば最優先で下敷きに。比率は変えず無加工で表示) */}
      {artUrl && (
        <image href={artUrl} x={vx} y={vy} width={vw} height={vh} preserveAspectRatio="xMidYMid meet" />
      )}

      {/* アートがないときは自前のシルエット描画 */}
      {!artUrl && (<>
      <g stroke="var(--ink)" strokeWidth={k * 0.0016} fill="none" opacity="0.25">
        <path d={`M ${vx + vw * 0.04} ${vy + vh * 0.32} q ${k * 0.02} ${-k * 0.012} ${k * 0.04} 0 q ${k * 0.02} ${k * 0.012} ${k * 0.04} 0`} />
        <path d={`M ${vx + vw * 0.06} ${vy + vh * 0.37} q ${k * 0.018} ${-k * 0.01} ${k * 0.036} 0`} />
        <path d={`M ${vx + vw * 0.86} ${vy + vh * 0.78} q ${k * 0.02} ${-k * 0.012} ${k * 0.04} 0 q ${k * 0.02} ${k * 0.012} ${k * 0.04} 0`} />
        <path d={`M ${vx + vw * 0.88} ${vy + vh * 0.83} q ${k * 0.018} ${-k * 0.01} ${k * 0.036} 0`} />
      </g>

      {/* 方位(コンパス) */}
      <g transform={`translate(${vx + vw * 0.92}, ${vy + vh * 0.12})`} stroke="var(--ink)" fill="none" opacity="0.5">
        <line x1="0" y1={k * 0.026} x2="0" y2={-k * 0.026} strokeWidth={k * 0.0016} />
        <line x1={-k * 0.018} y1="0" x2={k * 0.018} y2="0" strokeWidth={k * 0.0012} />
        <path d={`M 0 ${-k * 0.026} l ${k * 0.006} ${k * 0.012} l ${-k * 0.006} ${-k * 0.004} l ${-k * 0.006} ${k * 0.004} Z`} fill="var(--ink)" stroke="none" />
        <text x="0" y={-k * 0.034} textAnchor="middle" fontSize={k * 0.018} fill="var(--ink)" stroke="none" opacity="0.8">N</text>
      </g>

      {/* 県のかたち(古地図のカーキ) */}
      <g filter={`url(#wash-${pref.id})`}>
        <path d={pref.d} fill="#9C9272" fillOpacity="0.85" />
      </g>

      {/* 山と木の手描き(シルエットの上に薄く) */}
      <g stroke="var(--ink)" strokeWidth={k * 0.0022} fill="none" opacity="0.4" strokeLinejoin="round">
        <path d={`M ${vx + vw * 0.27 - k * 0.05} ${vy + vh * 0.4 + k * 0.022}
          L ${vx + vw * 0.27 - k * 0.012} ${vy + vh * 0.4 - k * 0.032}
          l ${k * 0.008} ${k * 0.01} l ${k * 0.008} ${-k * 0.008} l ${k * 0.006} ${k * 0.006}
          L ${vx + vw * 0.27 + k * 0.05} ${vy + vh * 0.4 + k * 0.022}`} />
        <path d={`M ${vx + vw * 0.19} ${vy + vh * 0.52} l ${k * 0.011} ${-k * 0.026} l ${k * 0.011} ${k * 0.026} Z
          M ${vx + vw * 0.19 + k * 0.011} ${vy + vh * 0.52} v ${k * 0.012}`} />
        <path d={`M ${vx + vw * 0.23} ${vy + vh * 0.55} l ${k * 0.009} ${-k * 0.021} l ${k * 0.009} ${k * 0.021} Z
          M ${vx + vw * 0.23 + k * 0.009} ${vy + vh * 0.55} v ${k * 0.01}`} />
      </g>
      </>)}

      {/* 達成/未達成の演出: 未達成(=記録なし)は常に少し暗く。
          達成した市区町村は、その境界に沿って温かく光らせて点滅させる。 */}
      <rect x={vx} y={vy} width={vw} height={vh} fill="#241c14" opacity="0.28" pointerEvents="none" />
      {munis && visitedMunis && munis.filter((m) => visitedMunis.has(m.code)).map((m) => {
        const hot = m.code === highlightMuni;
        return (
          <g key={"region" + m.code} className="atlas-visited" pointerEvents="none">
            {/* にじむ光(下地) */}
            <path d={m.path} fill="#FFD98A" fillOpacity={hot ? 0.6 : 0.42}
              filter={`url(#bloom-${pref.id})`} />
            {/* 本体の温かい塗り＋明るい縁取り */}
            <path d={m.path} fill={`url(#spotGlow-${pref.id})`} fillOpacity={hot ? 0.7 : 0.5}
              stroke="#FFEFC2" strokeWidth={k * (hot ? 0.007 : 0.0045)} strokeOpacity={hot ? 1 : 0.9}
              strokeLinejoin="round" />
          </g>
        );
      })}

      {/* 件数バッジ: 同じ市区町村に何件あっても1つにまとめて中心に表示 */}
      {munis && visitedMunis && muniCounts && munis.filter((m) => visitedMunis.has(m.code)).map((m) => {
        const cnt = muniCounts[m.code] ?? 0;
        if (!cnt) return null;
        const hot = m.code === highlightMuni;
        const r = k * (hot ? 0.016 : 0.013);
        return (
          <g key={"badge" + m.code} style={{ cursor: "pointer" }}
            onPointerUp={() => onMuniTap?.(m)}>
            {/* 光の輪 */}
            <circle className="atlas-visited" cx={m.cx} cy={m.cy} r={r * 2.1}
              fill="#FFD98A" opacity="0.5" filter={`url(#bloom-${pref.id})`} pointerEvents="none" />
            <circle cx={m.cx} cy={m.cy} r={r} fill="#9A5B3C"
              stroke="#FFEFC2" strokeWidth={k * 0.0018} opacity="0.98" />
            <text x={m.cx} y={m.cy + r * 0.36} textAnchor="middle"
              fontSize={r * 1.15} fontWeight="700" fill="#F7F2E7">
              {cnt}
            </text>
          </g>
        );
      })}

      {/* 区に属さない地点(埋め立て島など)のフォールバック: 点を温かく光らせる */}
      {(orphanPoints ?? []).map((p) => {
        const [x, y] = projGeo(p.lng, p.lat);
        if (x < vx || x > vx + vw || y < vy || y > vy + vh) return null;
        return (
          <g key={"orphan" + p.id} className="atlas-visited" pointerEvents="none">
            <circle cx={x} cy={y} r={k * 0.05} fill="#FFD98A" opacity="0.55" filter={`url(#bloom-${pref.id})`} />
            <circle cx={x} cy={y} r={k * 0.012} fill={`url(#spotGlow-${pref.id})`} />
            <circle cx={x} cy={y} r={k * 0.006} fill="#FFEFC2" />
          </g>
        );
      })}

      {/* 市区町村レイヤー(ヒット判定のみ・不可視)。アートはAI生成で数pxズレるため、
          表示は塗りでなく照準+地域名(座標ベース)で行う */}
      {munis && munis.map((m) => (
        <path key={m.code} d={m.path}
          fill="transparent"
          style={{ cursor: "none", pointerEvents: "all" }}
          onPointerEnter={() => setHoverMuni(m)}
          onPointerLeave={() => setHoverMuni((cur) => (cur?.code === m.code ? null : cur))}
          onPointerUp={() => onMuniTap?.(m)}
        />
      ))}

      {/* 照準+地域名: ホバー(薄) / 選択(固定) / 写真ホバー(点滅) */}
      {munis && (() => {
        const sel = selectedMuni ? munis.find((m) => m.code === selectedMuni) : null;
        const blink = blinkMuni ? munis.find((m) => m.code === blinkMuni) : null;
        const hov = hoverMuni && hoverMuni.code !== selectedMuni && hoverMuni.code !== blinkMuni ? hoverMuni : null;
        const reticle = (m: Muni, kind: "hover" | "sel" | "blink") => {
          const c = kind === "hover" ? "var(--ink-soft)" : "var(--tsuchi)";
          const o = kind === "hover" ? 0.65 : 0.95;
          return (
            <g key={`${kind}-${m.code}`} className={kind === "blink" ? "muni-blink" : undefined}
              opacity={o} pointerEvents="none">
              <line x1={m.cx - k * 0.028} y1={m.cy} x2={m.cx - k * 0.01} y2={m.cy} stroke={c} strokeWidth={k * 0.0016} />
              <line x1={m.cx + k * 0.01} y1={m.cy} x2={m.cx + k * 0.028} y2={m.cy} stroke={c} strokeWidth={k * 0.0016} />
              <line x1={m.cx} y1={m.cy - k * 0.028} x2={m.cx} y2={m.cy - k * 0.01} stroke={c} strokeWidth={k * 0.0016} />
              <line x1={m.cx} y1={m.cy + k * 0.01} x2={m.cx} y2={m.cy + k * 0.028} stroke={c} strokeWidth={k * 0.0016} />
              <circle cx={m.cx} cy={m.cy} r={k * 0.0042} fill={c} />
              {(() => {
                const right = m.cx < vx + vw * 0.68;
                return (
                  <text x={m.cx + (right ? k * 0.034 : -k * 0.034)} y={m.cy - k * 0.014}
                    textAnchor={right ? "start" : "end"}
                    fontSize={k * 0.034} fill="var(--ink)" stroke="var(--paper)" strokeWidth={k * 0.006}
                    paintOrder="stroke" style={{ fontFamily: "'Klee One', cursive" }}>
                    {m.name}
                  </text>
                );
              })()}
            </g>
          );
        };
        return (
          <>
            {hov && reticle(hov, "hover")}
            {sel && reticle(sel, "sel")}
            {blink && reticle(blink, "blink")}
          </>
        );
      })()}

      {/* 測量照準カーソル: 全幅の十字線+目盛り。ホバー地域へ視準の点線を引く */}
      {interactive && cursor && (
        <g pointerEvents="none">
          {hoverMuni && hoverMuni.code !== selectedMuni && (
            <line x1={cursor.x} y1={cursor.y} x2={hoverMuni.cx} y2={hoverMuni.cy}
              stroke="var(--tsuchi)" strokeWidth={k * 0.0014} strokeDasharray={`${k * 0.006} ${k * 0.005}`}
              opacity="0.7" />
          )}
          <line x1={vx} y1={cursor.y} x2={vx + vw} y2={cursor.y}
            stroke="var(--ink)" strokeWidth={k * 0.0011} opacity="0.32" />
          <line x1={cursor.x} y1={vy} x2={cursor.x} y2={vy + vh}
            stroke="var(--ink)" strokeWidth={k * 0.0011} opacity="0.32" />
          <circle cx={cursor.x} cy={cursor.y} r={k * 0.018} fill="none"
            stroke="var(--ink)" strokeWidth={k * 0.0013} opacity="0.5" />
          <circle cx={cursor.x} cy={cursor.y} r={k * 0.0018} fill="var(--tsuchi)" opacity="0.9" />
          {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => (
            <line key={i}
              x1={cursor.x + sx * k * 0.0125} y1={cursor.y + sy * k * 0.0125}
              x2={cursor.x + sx * k * 0.022} y2={cursor.y + sy * k * 0.022}
              stroke="var(--ink)" strokeWidth={k * 0.0011} opacity="0.4" />
          ))}
        </g>
      )}

    </svg>
  );
}
