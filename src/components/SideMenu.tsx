"use client";

import { useEffect, useState } from "react";
import { countryByCode, JAPAN_CODE } from "@/lib/world";
import { PREFECTURES } from "@/lib/prefectures";
import type { RecordWithPhotos } from "@/lib/records";
import { fetchFollowing, fetchFollowers, type FollowUser } from "@/lib/follows";
import { avatarUrl } from "@/lib/profiles";

type Props = {
  open: boolean;
  onClose: () => void;
  countryCounts: Record<string, number>;
  prefCounts: Record<number, number>;
  favoriteRecords: RecordWithPhotos[]; // お気に入りに登録した記録(自分・他人とも)
  onGlobe: () => void;
  onLog: () => void;
  onSearch: () => void;
  onShared: () => void;
  onPlans: () => void;
  onClips: () => void;
  onSharedPlans: () => void;
  onProfile: () => void;
  onLogout: () => void;
  onCountry: (code: string) => void; // 地球ズーム経由で国へ
  onPref: (id: number) => void; // 地球→日本ズーム経由で県へ
  onSelectSpot: (r: RecordWithPhotos) => void;
  onOpenUser: (u: { userId: string; displayName: string | null }) => void; // 他ユーザーのプロフィールを開く
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
  favoriteRecords, onGlobe, onLog, onSearch, onShared, onPlans, onClips, onSharedPlans,
  onProfile, onLogout, onCountry, onPref, onSelectSpot, onOpenUser,
}: Props) {
  const [openRegion, setOpenRegion] = useState<number | null>(null);
  const [favOpen, setFavOpen] = useState(false);
  const [openFavPref, setOpenFavPref] = useState<number | null>(null);
  const [following, setFollowing] = useState<FollowUser[] | null>(null);
  const [followers, setFollowers] = useState<FollowUser[] | null>(null);
  const [connTab, setConnTab] = useState<"following" | "followers" | null>(null);

  // メニューを開いたタイミングでフォロー/フォロワーを取得
  useEffect(() => {
    if (!open) return;
    fetchFollowing().then(setFollowing).catch(() => setFollowing([]));
    fetchFollowers().then(setFollowers).catch(() => setFollowers([]));
  }, [open]);

  // お気に入りレコードを都道府県別にグルーピング
  const favRecords = favoriteRecords;
  const favByPref = new Map<number | null, RecordWithPhotos[]>();
  for (const r of favRecords) {
    const key = r.pref_code;
    if (!favByPref.has(key)) favByPref.set(key, []);
    favByPref.get(key)!.push(r);
  }
  // 都道府県コードでソート(nullは最後)
  const favPrefEntries = [...favByPref.entries()].sort((a, b) => {
    if (a[0] == null) return 1;
    if (b[0] == null) return -1;
    return a[0] - b[0];
  });

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

  const UserList = ({ users }: { users: FollowUser[] | null }) => {
    if (users === null) return <div style={{ fontSize: 11.5, color: "#5C574B", padding: "6px 4px" }}>読み込み中…</div>;
    if (users.length === 0) return <div style={{ fontSize: 11.5, color: "#5C574B", padding: "6px 4px" }}>まだいません</div>;
    return (
      <div style={{ borderLeft: "1px solid rgba(237,232,220,0.14)", marginLeft: 3, paddingLeft: 12, marginBottom: 6 }}>
        {users.map((u) => {
          const url = avatarUrl(u.avatar_path);
          return (
            <button key={u.id} style={{ ...itemStyle, padding: "7px 4px", fontSize: 12.5, color: "#C9C2B2" }}
              onClick={() => { onClose(); onOpenUser({ userId: u.id, displayName: u.display_name }); }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                background: "#3a3630", display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(201,168,106,0.5)" }}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 11, color: "#E3C58C", fontFamily: "serif" }}>{u.display_name ? u.display_name.charAt(0) : "?"}</span>
                )}
              </span>
              {u.display_name ?? "名無し"}
            </button>
          );
        })}
      </div>
    );
  };

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

        <Cap>PLAN — お出かけ</Cap>
        <button style={itemStyle} onClick={onPlans}>🚩 お出かけプラン</button>
        <button style={itemStyle} onClick={onClips}>📍 クリップ（行きたい場所）</button>
        <button style={itemStyle} onClick={onSharedPlans}>✨ みんなのプラン</button>

        <Cap>RECORDS</Cap>
        <button style={itemStyle} onClick={onSearch}>記録をさがす</button>
        <button style={itemStyle} onClick={onLog}>ログ一覧</button>
        <button style={itemStyle} onClick={onShared}>みんなの図鑑</button>

        <Cap>CONNECTIONS — つながり</Cap>
        <button style={itemStyle} onClick={() => setConnTab(connTab === "following" ? null : "following")}>
          フォロー
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#857E70", letterSpacing: "0.1em" }}>
            {following?.length ?? "—"} {connTab === "following" ? "−" : "+"}
          </span>
        </button>
        {connTab === "following" && <UserList users={following} />}
        <button style={itemStyle} onClick={() => setConnTab(connTab === "followers" ? null : "followers")}>
          フォロワー
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#857E70", letterSpacing: "0.1em" }}>
            {followers?.length ?? "—"} {connTab === "followers" ? "−" : "+"}
          </span>
        </button>
        {connTab === "followers" && <UserList users={followers} />}

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

        <Cap>FAVORITES — お気に入り</Cap>
        {favRecords.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "#5C574B", lineHeight: 1.9, padding: "6px 4px" }}>
            まだお気に入りがありません。<br />記録の ♡ ボタンで追加できます。
          </div>
        ) : (
          <>
            <button style={itemStyle} onClick={() => setFavOpen(!favOpen)}>
              <span style={{ fontSize: 14 }}>♡</span>
              お気に入り
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#857E70", letterSpacing: "0.1em" }}>
                {favRecords.length} {favOpen ? "−" : "+"}
              </span>
            </button>
            {favOpen && (
              <div style={{ borderLeft: "1px solid rgba(237,232,220,0.14)", marginLeft: 3, paddingLeft: 14, marginBottom: 6 }}>
                {favPrefEntries.map(([prefCode, recs]) => {
                  const prefName = prefCode != null
                    ? (PREFECTURES.find((p) => p.id === prefCode)?.name ?? `都道府県${prefCode}`)
                    : "海外・その他";
                  const isOpen = openFavPref === prefCode;
                  return (
                    <div key={prefCode ?? "null"}>
                      <button style={{ ...itemStyle, padding: "7px 4px", fontSize: 12.5 }}
                        onClick={() => setOpenFavPref(isOpen ? null : prefCode)}>
                        {prefName}
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#857E70" }}>
                          {recs.length} {isOpen ? "−" : "+"}
                        </span>
                      </button>
                      {isOpen && (
                        <div style={{ borderLeft: "1px solid rgba(237,232,220,0.1)", marginLeft: 3, paddingLeft: 12, marginBottom: 4 }}>
                          {recs.map((r) => (
                            <button key={r.id} style={{ ...itemStyle, padding: "6px 4px", fontSize: 12, color: "#A09888" }}
                              onClick={() => { onClose(); onSelectSpot(r); }}>
                              {r.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

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
