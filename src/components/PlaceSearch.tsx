"use client";

import { useMemo, useState } from "react";
import { COUNTRIES, JAPAN_CODE } from "@/lib/world";
import { PREFECTURES, PREF_EN } from "@/lib/prefectures";

// 主要国の日本語名(日本語入力でも飛べるように)。ISO数値コード→別名
const JP_ALIAS: Record<string, string> = {
  "392": "日本 にっぽん", "840": "アメリカ 米国 アメリカ合衆国", "250": "フランス",
  "380": "イタリア", "724": "スペイン", "276": "ドイツ", "826": "イギリス 英国",
  "410": "韓国 かんこく", "156": "中国 ちゅうごく", "158": "台湾 たいわん",
  "764": "タイ", "704": "ベトナム", "36": "オーストラリア", "124": "カナダ",
  "756": "スイス", "528": "オランダ", "702": "シンガポール", "360": "インドネシア",
  "608": "フィリピン", "356": "インド", "818": "エジプト", "792": "トルコ",
  "300": "ギリシャ", "620": "ポルトガル", "40": "オーストリア", "56": "ベルギー",
  "554": "ニュージーランド", "484": "メキシコ", "76": "ブラジル", "344": "香港",
  "752": "スウェーデン", "578": "ノルウェー", "208": "デンマーク", "246": "フィンランド",
};

type Item =
  | { kind: "pref"; id: number; label: string; hay: string }
  | { kind: "country"; code: string; label: string; hay: string };

type Props = {
  onPickCountry: (code: string) => void;
  onPickPref: (id: number) => void;
};

export default function PlaceSearch({ onPickCountry, onPickPref }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const items = useMemo<Item[]>(() => {
    const prefs: Item[] = PREFECTURES.map((p) => ({
      kind: "pref",
      id: p.id,
      label: `${p.name}（日本）`,
      hay: `${p.name} ${PREF_EN[p.id] ?? ""} 日本`.toLowerCase(),
    }));
    const countries: Item[] = COUNTRIES.filter((c) => c.code !== JAPAN_CODE).map((c) => ({
      kind: "country",
      code: c.code,
      label: c.name,
      hay: `${c.name} ${JP_ALIAS[c.code] ?? ""}`.toLowerCase(),
    }));
    return [...prefs, ...countries];
  }, []);

  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    return items.filter((it) => it.hay.includes(kw)).slice(0, 8);
  }, [q, items]);

  const pick = (it: Item) => {
    setOpen(false);
    setQ("");
    if (it.kind === "country") onPickCountry(it.code);
    else onPickPref(it.id);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="場所を検索"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", border: "1px solid rgba(237,232,220,0.4)", background: "rgba(11,14,20,0.55)", color: "#EDE8DC", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.12em", borderRadius: 999 }}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="15" y2="15" />
        </svg>
        場所を検索
      </button>
    );
  }

  return (
    <div style={{ width: "min(340px, 86vw)", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(11,14,20,0.92)", border: "1px solid rgba(237,232,220,0.4)", borderRadius: results.length ? "14px 14px 0 0" : 999, padding: "10px 14px" }}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#EDE8DC" strokeWidth="1.4">
          <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="15" y2="15" />
        </svg>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="国・都道府県名（例: フランス / 長野）"
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) pick(results[0]); if (e.key === "Escape") { setOpen(false); setQ(""); } }}
          style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#EDE8DC", fontSize: 14, fontFamily: "inherit" }} />
        <button onClick={() => { setOpen(false); setQ(""); }} aria-label="閉じる"
          style={{ background: "none", border: "none", color: "#857E70", fontSize: 16, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>×</button>
      </div>
      {results.length > 0 && (
        <div style={{ background: "rgba(11,14,20,0.95)", border: "1px solid rgba(237,232,220,0.4)", borderTop: "none", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
          {results.map((it) => (
            <button key={it.kind + (it.kind === "pref" ? it.id : it.code)} onClick={() => pick(it)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", borderTop: "1px solid rgba(237,232,220,0.1)", color: "#EDE8DC", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
