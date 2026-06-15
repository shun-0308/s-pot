"use client";

import { useState } from "react";
import { countryByCode, JAPAN_CODE } from "@/lib/world";
import { PREFECTURES } from "@/lib/prefectures";

type Props = {
  open: boolean;
  onClose: () => void;
  countryCounts: Record<string, number>;
  prefCounts: Record<number, number>;
  onGlobe: () => void;
  onLog: () => void;
  onSearch: () => void;
  onShared: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onCountry: (code: string) => void; // 地球ズーム経由で国へ
  onPref: (id: number) => void; // 地球→日本ズーム経由で県へ
};

const REGIONS = [
  { name: "北海道・東北", a: 1, b: 7, color: "#9DBE8D" },
  { name: "関東", a: 8, b: 14, color: "#8FB7CC" },
  { name: "中部", a: 15, b: 23, color: "#A8C8B8" },
  { name: "近畿", a: 24, b: 30, color: "#C9A8D4" },
  { name: "中国・四国", a: 31, b: 39, color: "#E0A878" },
  { name: "九州・沖縄", a: 40, b: 47, color: "#D9C97E" },
];

const itemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%",
  background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
  color: "#C9C2B2", fontSize: 13.5, padding: "10px 4px", textAlign: "left",
  letterSpacing: "0.06em",
};

export default function SideMenu({
  open, onClose, countryCounts, prefCounts,
  onGlobe, onLog, onSearch, onShared, onProfile, onLogout, onCountry, onPref,
}: Props) {
  const [openRegion, setOpenRegion] = useState<number | null>(null);

  const visitedCountries = Object.keys(countryCounts)
    .filter((code) => code !== JAPAN_CODE && countryCounts[code] > 0)
    .map((code) => ({ code, name: countryByCode(code)?.name ?? code, n: countryCounts[code] }))
    .sort((a, b) => b.n - a.n);

  const Count = ({ n }: { n: number }) => (
    <span style={{ marginLeft: "auto", fontSize: 11, color: n ? "#D8856E" : "#5C574B", letterSpacing: "0.1em" }}>
      {n || "—"}
    </span>
  );
  const Cap = ({ children }: { children: React.ReactNode }) => (
    <div className="caption" style={{ color: "#6B6557", margin: "22px 0 4px", fontSize: 9.5 }}>{children}</div>
  );

  return (
    <>
      {/* 背景 */}
      <div onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(7,8,12,0.55)",
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .3s ease" }} />

      {/* ドロワー */}
      <aside style={{ position: "fixed", top: 0, bottom: 0, left: 0, width: 286, zIndex: 81,
        background: "rgba(13,16,23,0.97)", borderRight: "1px solid rgba(237,232,220,0.12)",
        transform: open ? "translateX(0)" : "translateX(-100%)", transition: "transform .32s ease",
        overflowY: "auto", padding: "26px 22px 30px",
        paddingBottom: "calc(30px + env(safe-area-inset-bottom))" }}>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div>
            <div className="caption" style={{ color: "#6B6557" }}>MY TRAVEL ATLAS</div>
            <div className="tz-serif" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.16em", color: "#EDE8DC", marginTop: 4 }}>
              S-pot
            </div>
          </div>
          <button onClick={onClose} aria-label="閉じる"
            style={{ background: "none", border: "none", color: "#857E70", fontSize: 18, cursor: "pointer", fontFamily: "inherit", padding: 4 }}>
            ×
          </button>
        </div>

        <Cap>ATLAS</Cap>
        <button style={itemStyle} onClick={onGlobe}>地球</button>
        <button style={itemStyle} onClick={() => onCountry(JAPAN_CODE)}>
          日本地図
          <Count n={countryCounts[JAPAN_CODE] ?? 0} />
        </button>

        <Cap>RECORDS</Cap>
        <button style={itemStyle} onClick={onSearch}>記録をさがす</button>
        <button style={itemStyle} onClick={onLog}>ログ一覧</button>
        <button style={itemStyle} onClick={onShared}>みんなの図鑑</button>

        <Cap>COUNTRIES — 国別</Cap>
        {visitedCountries.length === 0 && (
          <div style={{ fontSize: 11.5, color: "#5C574B", lineHeight: 1.9, padding: "6px 4px" }}>
            海外の記録はまだありません。<br />海外写真を読み込むと、ここに国が増えていきます。
          </div>
        )}
        {visitedCountries.map((c) => (
          <button key={c.code} style={itemStyle} onClick={() => onCountry(c.code)}>
            {c.name}
            <Count n={c.n} />
          </button>
        ))}

        <Cap>REGIONS — 地域別(日本)</Cap>
        {REGIONS.map((rg, i) => {
          const prefs = PREFECTURES.filter((p) => p.id >= rg.a && p.id <= rg.b);
          const visited = prefs.filter((p) => (prefCounts[p.id] ?? 0) > 0).length;
          const opened = openRegion === i;
          return (
            <div key={rg.name}>
              <button style={itemStyle} onClick={() => setOpenRegion(opened ? null : i)}>
                <span style={{ width: 8, height: 8, background: rg.color, flexShrink: 0 }} />
                {rg.name}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#857E70", letterSpacing: "0.1em" }}>
                  {visited}/{prefs.length} {opened ? "−" : "+"}
                </span>
              </button>
              {opened && (
                <div style={{ borderLeft: "1px solid rgba(237,232,220,0.14)", marginLeft: 3, paddingLeft: 14, marginBottom: 6 }}>
                  {prefs.map((p) => (
                    <button key={p.id} style={{ ...itemStyle, padding: "7px 4px", fontSize: 12.5, color: (prefCounts[p.id] ?? 0) > 0 ? "#C9C2B2" : "#6B6557" }}
                      onClick={() => onPref(p.id)}>
                      {p.name}
                      <Count n={prefCounts[p.id] ?? 0} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ borderTop: "1px solid rgba(237,232,220,0.12)", marginTop: 26, paddingTop: 14 }}>
          <button style={{ ...itemStyle, color: "#857E70", fontSize: 12 }} onClick={onProfile}>
            プロフィール設定
          </button>
          <button style={{ ...itemStyle, color: "#857E70", fontSize: 12 }} onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
}
