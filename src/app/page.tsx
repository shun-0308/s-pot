"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import JapanMap from "@/components/JapanMap";
import AuthForm from "@/components/AuthForm";
import PrefPage from "@/components/PrefPage";
import CountryPage from "@/components/CountryPage";
import SpotDetail from "@/components/SpotDetail";
import SharedFeed from "@/components/SharedFeed";
import SearchPage from "@/components/SearchPage";
import GlobeView from "@/components/GlobeView";
import SideMenu from "@/components/SideMenu";
import StampCelebration from "@/components/StampCelebration";
import type { FormValues } from "@/components/RecordForm";
import { supabase } from "@/lib/supabase";
import { readExif, exifDateToISO } from "@/lib/exif";
import { prefFromGPS } from "@/lib/geo";
import { geocodePlace } from "@/lib/geocode";
import { countryFromGPS, countryByCode, JAPAN_CODE, type Country } from "@/lib/world";
import {
  fetchRecords, createRecord, updateRecord, deleteRecord, addPhoto,
  type RecordWithPhotos,
} from "@/lib/records";
import { captionOf, prefByCode, PREF_EN, type Prefecture } from "@/lib/prefectures";
import Photo from "@/components/Photo";

type View = "globe" | "japan" | "country" | "shared" | "log" | "search";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [records, setRecords] = useState<RecordWithPhotos[]>([]);
  const [view, setView] = useState<View>("globe");
  const [globeFromJapan, setGlobeFromJapan] = useState(false);
  const [pref, setPref] = useState<Prefecture | null>(null);
  const [country, setCountry] = useState<Country | null>(null);
  const [spot, setSpot] = useState<RecordWithPhotos | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [autoMsg, setAutoMsg] = useState<string | null>(null);
  const [formInitial, setFormInitial] = useState<Partial<FormValues> | undefined>();
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [stamp, setStamp] = useState<{ pref: string; no: number; first: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [flyTo, setFlyTo] = useState<{ code: string; key: number } | null>(null);
  const [pendingPref, setPendingPref] = useState<number | null>(null);
  const autoRef = useRef<HTMLInputElement>(null);

  // セッション監視
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // 記録ロード
  const reload = useCallback(async () => {
    try {
      setRecords(await fetchRecords());
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込みに失敗しました");
    }
  }, []);
  useEffect(() => {
    if (session) reload();
    else setRecords([]);
  }, [session, reload]);

  // 集計: 国別(地球用)と県別(日本地図用)
  const countryCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of records) c[r.country_code] = (c[r.country_code] ?? 0) + 1;
    return c;
  }, [records]);
  const prefCounts = useMemo(() => {
    const c: Record<number, number> = {};
    for (const r of records)
      if (r.country_code === JAPAN_CODE && r.pref_code != null)
        c[r.pref_code] = (c[r.pref_code] ?? 0) + 1;
    return c;
  }, [records]);

  const resetEntryState = () => {
    setAdding(false);
    setAutoMsg(null);
    setFormInitial(undefined);
    setGps(null);
  };

  // ── メニューからのナビゲーション(地球ズーム経由) ──
  const navToCountry = (code: string) => {
    setMenuOpen(false);
    resetEntryState();
    setSpot(null); setPref(null); setCountry(null);
    setPendingPref(null);
    setGlobeFromJapan(false);
    setFlyTo({ code, key: Date.now() });
    setView("globe");
  };
  const navToPref = (id: number) => {
    setMenuOpen(false);
    resetEntryState();
    setSpot(null); setPref(null); setCountry(null);
    setPendingPref(id);
    setGlobeFromJapan(false);
    setFlyTo({ code: JAPAN_CODE, key: Date.now() });
    setView("globe");
  };

  // ── 写真から自動記録(EXIF → 国判定 → 日本なら県判定 → フォーム) ──
  const autoFromPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    let meta: Awaited<ReturnType<typeof readExif>> = {};
    try { meta = await readExif(f); } catch {}
    if (meta.lat && meta.lon) {
      const c = countryFromGPS(meta.lon, meta.lat);
      const init = { taken_at: exifDateToISO(meta.date) ?? "", photos: [f] };
      if (c?.code === JAPAN_CODE) {
        const p = prefFromGPS(meta.lon, meta.lat);
        if (p) {
          setPref(p); setCountry(null); setSpot(null); setAdding(true);
          setGps({ lat: meta.lat, lng: meta.lon });
          setFormInitial(init);
          setAutoMsg(`📍 位置情報から「${p.name}」と判定しました`);
          setView("japan");
          return;
        }
      } else if (c) {
        setCountry(c); setPref(null); setSpot(null); setAdding(true);
        setGps({ lat: meta.lat, lng: meta.lon });
        setFormInitial(init);
        setAutoMsg(`📍 位置情報から「${c.name}」と判定しました`);
        setView("country");
        return;
      }
    }
    setAutoMsg("この写真には位置情報がありませんでした(スクショやアプリ経由の保存はGPSが消えます)。国・県をえらんで手動で記録できます。");
  };

  // ── CRUD ──
  const handleCreate = async (v: FormValues) => {
    const isJP = view === "japan" && pref != null;
    const isWorld = view === "country" && country != null;
    if (!isJP && !isWorld) return;
    setBusy(true);
    setError(null);
    try {
      const code = isJP ? JAPAN_CODE : country!.code;
      const placeName = isJP ? pref!.name : country!.name;
      const prevCount = records.filter((r) =>
        isJP ? r.pref_code === pref!.id && r.country_code === JAPAN_CODE : r.country_code === code
      ).length;
      // 写真にGPSが無ければ、場所名から座標を補完(踏破率・市区町村判定のため)
      let coords: { lat: number; lng: number } | null = gps;
      if (!coords && v.name.trim()) {
        const q = isJP ? `${v.name} ${pref!.name}` : `${v.name} ${country!.name}`;
        const g = await geocodePlace(q, { jpOnly: isJP });
        if (g) coords = { lat: g.lat, lng: g.lon };
      }
      await createRecord(
        {
          pref_code: isJP ? pref!.id : null,
          country_code: code,
          name: v.name,
          taken_at: v.taken_at || null,
          body: v.body,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
          visibility: v.visibility,
          scout: Object.values(v.scout).some(Boolean) ? v.scout : null,
        },
        v.photos
      );
      await reload();
      setStamp({ pref: placeName, no: prevCount + 1, first: prevCount === 0 });
      resetEntryState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (rec: RecordWithPhotos, v: FormValues) => {
    setBusy(true);
    setError(null);
    try {
      await updateRecord(rec.id, {
        name: v.name,
        taken_at: v.taken_at || null,
        body: v.body,
        visibility: v.visibility,
        scout: Object.values(v.scout).some(Boolean) ? v.scout : null,
      });
      // 既存写真の後ろに、選んだ順で追加
      const base = rec.photos.length;
      for (let i = 0; i < v.photos.length; i++) await addPhoto(rec.id, v.photos[i], base + i);
      const fresh = await fetchRecords();
      setRecords(fresh);
      setSpot(fresh.find((r) => r.id === rec.id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (rec: RecordWithPhotos) => {
    setBusy(true);
    setError(null);
    try {
      await deleteRecord(rec);
      await reload();
      setSpot(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  // ── 画面分岐 ──
  if (!authReady) return null;

  const MenuBtn = ({ dark = false }: { dark?: boolean }) => (
    <button aria-label="メニュー" onClick={() => setMenuOpen(true)}
      style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 8px", display: "inline-flex", flexDirection: "column", gap: 4.5, minHeight: 0 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ display: "block", width: 20, height: 1.5, background: dark ? "#EDE8DC" : "var(--ink)" }} />
      ))}
    </button>
  );

  const overlays = (
    <>
      {stamp && (
        <StampCelebration prefName={stamp.pref} no={stamp.no} first={stamp.first}
          onDone={() => setStamp(null)} />
      )}
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        countryCounts={countryCounts}
        prefCounts={prefCounts}
        onGlobe={() => { setMenuOpen(false); resetEntryState(); setSpot(null); setPref(null); setCountry(null); setPendingPref(null); setFlyTo(null); setGlobeFromJapan(false); setView("globe"); }}
        onLog={() => { setMenuOpen(false); setSpot(null); setView("log"); }}
        onSearch={() => { setMenuOpen(false); setSpot(null); setView("search"); }}
        onShared={() => { setMenuOpen(false); setSpot(null); setView("shared"); }}
        onLogout={() => { setMenuOpen(false); supabase.auth.signOut(); }}
        onCountry={navToCountry}
        onPref={navToPref}
      />
    </>
  );

  // DEV_BYPASS: if (!session) return <AuthForm />;

  const errorBar = error && (
    <div style={{ maxWidth: 700, margin: "0 auto 12px", padding: "8px 14px", borderLeft: "2px solid var(--shu)", fontSize: 12.5, color: "var(--shu)" }}>
      {error}
    </div>
  );

  // ── 地球(ホーム) ──
  if (view === "globe")
    return (
      <>
        {overlays}
        <GlobeView
          counts={countryCounts}
          startFromJapan={globeFromJapan}
          flyToCode={flyTo?.code ?? null}
          flyToKey={flyTo?.key}
          onEnterJapan={() => {
            setGlobeFromJapan(false); resetEntryState(); setSpot(null); setFlyTo(null);
            if (pendingPref != null) { setPref(prefByCode(pendingPref) ?? null); setPendingPref(null); }
            else setPref(null);
            setView("japan");
          }}
          onEnterCountry={(c) => { setGlobeFromJapan(false); resetEntryState(); setFlyTo(null); setCountry(c); setSpot(null); setView("country"); }}
        />
        {/* 地球上のメニュー */}
        <div style={{ position: "fixed", top: 14, left: 14, zIndex: 10 }}>
          <MenuBtn dark />
        </div>
        <div style={{ position: "fixed", bottom: 56, left: 0, right: 0, textAlign: "center", zIndex: 10 }}>
          <button onClick={() => autoRef.current?.click()}
            style={{ padding: "12px 26px", border: "1px solid rgba(237,232,220,0.4)", background: "rgba(11,14,20,0.55)", color: "#EDE8DC", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.18em" }}>
            写真から自動記録
          </button>
          <input ref={autoRef} type="file" accept="image/jpeg,image/jpg,image/*" hidden onChange={autoFromPhoto} />
          {autoMsg && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: "#A39A87", padding: "0 24px", lineHeight: 1.8 }}>{autoMsg}</div>
          )}
        </div>
      </>
    );

  if (view === "shared")
    return <>{overlays}<SharedFeed onBack={() => setView("globe")} /></>;

  if (view === "search")
    return (
      <>
        {overlays}
        {errorBar}
        <SearchPage records={records} onBack={() => setView("globe")} onSelectSpot={setSpot} />
      </>
    );

  // ── 記録詳細(日本・海外 共通) ──
  if (spot) {
    const backLabel = view === "log"
      ? "ログ一覧"
      : spot.country_code === JAPAN_CODE
        ? `${prefByCode(spot.pref_code ?? 0)?.name ?? "日本"}の記録`
        : `${countryByCode(spot.country_code)?.name ?? ""}の記録`;
    const captionText = spot.country_code === JAPAN_CODE
      ? captionOf(spot.pref_code, spot.taken_at)
      : `${(countryByCode(spot.country_code)?.name ?? "").toUpperCase()}${spot.taken_at ? ` — ${spot.taken_at.replaceAll("-", ".")}` : ""}`;
    return (
      <>
        {overlays}
        {errorBar}
        <SpotDetail backLabel={backLabel} captionText={captionText} rec={spot} busy={busy}
          onBack={() => setSpot(null)} onUpdate={handleUpdate} onDelete={handleDelete} />
      </>
    );
  }

  // ── ログ一覧(全記録タイムライン) ──
  if (view === "log") {
    const logCaption = (r: RecordWithPhotos) =>
      r.country_code === JAPAN_CODE
        ? captionOf(r.pref_code, r.taken_at)
        : `${(countryByCode(r.country_code)?.name ?? "").toUpperCase()}${r.taken_at ? ` — ${r.taken_at.replaceAll("-", ".")}` : ""}`;
    let lastYear = "";
    const rows: React.ReactNode[] = [];
    for (const r of records) {
      const y = r.taken_at?.slice(0, 4) ?? "日付なし";
      if (y !== lastYear) {
        lastYear = y;
        rows.push(
          <div key={"y" + y} className="caption" style={{ margin: "28px 0 2px", fontSize: 11, letterSpacing: "0.32em", color: "var(--shu)" }}>
            {y}
          </div>
        );
      }
      rows.push(
        <div key={r.id} onClick={() => setSpot(r)} className="entry" role="button" tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && setSpot(r)}
          style={{ display: "flex", gap: 14, padding: "14px 0", borderBottom: "1px solid var(--hairline)", alignItems: "center" }}>
          <div style={{ flexShrink: 0, width: 72 }}><Photo rec={r} w={72} h={72} /></div>
          <div style={{ minWidth: 0 }}>
            <div className="caption" style={{ fontSize: 9 }}>{logCaption(r)}</div>
            <div className="tz-serif" style={{ fontSize: 15.5, fontWeight: 700, marginTop: 2, lineHeight: 1.5 }}>{r.name}</div>
            {r.body && (
              <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.8, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                {r.body}
              </div>
            )}
          </div>
        </div>
      );
    }
    return (
      <>
        {overlays}
        {errorBar}
        <div style={{ padding: "26px 20px 70px" }}>
          <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: -8 }}>
              <MenuBtn />
              <button onClick={() => setView("globe")}
                style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>
                ← 地球へ
              </button>
            </div>
            <div className="caption" style={{ marginTop: 16 }}>ALL RECORDS</div>
            <h2 className="tz-serif" style={{ fontSize: 26, fontWeight: 700, margin: "2px 0 4px", letterSpacing: "0.1em" }}>
              ログ一覧
            </h2>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)", letterSpacing: "0.08em" }}>
              {records.length} 件の記録
            </div>
            {records.length === 0 && (
              <div style={{ fontSize: 13, color: "var(--ink-soft)", textAlign: "center", padding: "44px 20px", lineHeight: 2.2, border: "1px dashed var(--ink-faint)", marginTop: 18 }}>
                まだ記録がありません。<br />写真から自動記録で、最初の1ページを。
              </div>
            )}
            {rows}
          </div>
        </div>
      </>
    );
  }

  // ── 海外: 国ページ ──
  if (view === "country" && country)
    return (
      <>
        {overlays}
        {errorBar}
        <CountryPage
          country={country}
          records={records.filter((r) => r.country_code === country.code)}
          adding={adding}
          autoMsg={autoMsg}
          formInitial={formInitial}
          busy={busy}
          onBack={() => { resetEntryState(); setCountry(null); setView("globe"); }}
          onSelectSpot={setSpot}
          onStartAdd={() => { setFormInitial(undefined); setGps(null); setAdding(true); }}
          onCancelAdd={resetEntryState}
          onCreate={handleCreate}
        />
      </>
    );

  // ── 日本: 県ページ ──
  if (view === "japan" && pref)
    return (
      <>
        {overlays}
        {errorBar}
        <PrefPage
          pref={pref}
          records={records.filter((r) => r.country_code === JAPAN_CODE && r.pref_code === pref.id)}
          adding={adding}
          autoMsg={autoMsg}
          formInitial={formInitial}
          busy={busy}
          onBack={() => { resetEntryState(); setPref(null); }}
          onSelectSpot={setSpot}
          onStartAdd={() => { setFormInitial(undefined); setGps(null); setAdding(true); }}
          onCancelAdd={resetEntryState}
          onCreate={handleCreate}
        />
      </>
    );

  // ── 日本地図ビュー ──
  const visitedCount = Object.keys(prefCounts).length;
  const jpRecords = records.filter((r) => r.country_code === JAPAN_CODE);
  const thisYear = String(new Date().getFullYear());
  const yearCount = jpRecords.filter((r) => r.taken_at?.startsWith(thisYear)).length;
  return (
    <div style={{ padding: "28px 14px 60px" }}>
      {overlays}
      <header style={{ maxWidth: "min(1760px, 94vw)", margin: "0 auto 10px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 8px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 8, marginLeft: -8 }}>
            <MenuBtn />
            <button onClick={() => { resetEntryState(); setGlobeFromJapan(true); setView("globe"); }}
              style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>
              ← 地球へ
            </button>
          </div>
          <div className="caption">JAPAN — MY TRAVEL ATLAS</div>
          <h1 className="tz-serif" style={{ fontSize: 32, fontWeight: 700, margin: "4px 0 0", letterSpacing: "0.12em" }}>S-pot</h1>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="tz-serif" style={{ fontSize: 26, fontWeight: 700, color: "var(--shu)" }}>
            {visitedCount}<span style={{ fontSize: 12, color: "var(--ink-faint)", letterSpacing: "0.1em" }}> / 47</span>
          </div>
          <div className="caption" style={{ letterSpacing: "0.18em" }}>{jpRecords.length} RECORDS</div>
        </div>
      </header>

      <div style={{ maxWidth: "min(1760px, 94vw)", margin: "0 auto 14px", padding: "0 8px", display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
        <button onClick={() => autoRef.current?.click()}
          style={{ padding: "12px 22px", border: "none", background: "var(--shu)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.14em" }}>
          写真から自動記録
        </button>
        <input ref={autoRef} type="file" accept="image/jpeg,image/jpg,image/*" hidden onChange={autoFromPhoto} />
        <button onClick={() => setView("shared")}
          style={{ padding: "12px 18px", border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.14em" }}>
          みんなの図鑑
        </button>
        {autoMsg && !adding && <span style={{ fontSize: 12, color: "var(--ink-soft)", flex: 1, minWidth: 200, alignSelf: "center", lineHeight: 1.7 }}>{autoMsg}</span>}
      </div>

      {/* 統計列 */}
      <div style={{ maxWidth: "min(1760px, 94vw)", margin: "0 auto 14px", padding: "0 8px" }}>
        <div style={{ display: "flex", border: "1px solid var(--hairline)", background: "var(--paper-raise)" }}>
          {[
            { label: "VISITED", value: `${visitedCount}`, unit: "/ 47県" },
            { label: "RECORDS", value: `${jpRecords.length}`, unit: "件" },
            { label: "THIS YEAR", value: `${yearCount}`, unit: "件" },
          ].map((s, i) => (
            <div key={s.label} style={{ flex: 1, padding: "12px 14px", borderLeft: i ? "1px solid var(--hairline)" : "none" }}>
              <div className="caption" style={{ fontSize: 9, letterSpacing: "0.26em" }}>{s.label}</div>
              <div style={{ marginTop: 3 }}>
                <span className="tz-serif" style={{ fontSize: 22, fontWeight: 700, color: i === 0 ? "var(--shu)" : "var(--ink)" }}>{s.value}</span>
                <span style={{ fontSize: 11, color: "var(--ink-faint)", marginLeft: 4 }}>{s.unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {errorBar}

      {/* 左に大きな地図 / 右に画鋲チェキ */}
      <div style={{ maxWidth: "min(1760px, 94vw)", margin: "0 auto", padding: "0 8px" }}>
        <div className="japan-grid">
          {/* 地図(角丸+やわらかい影で紙に貼った地図のように) */}
          <div>
            <div className="map-soft">
              <JapanMap counts={prefCounts} onSelect={(p) => { setPref(p); setSpot(null); setAdding(false); setAutoMsg(null); }} />
            </div>
            <p style={{ margin: "14px 4px 0", fontSize: 11.5, color: "var(--ink-faint)", letterSpacing: "0.08em" }}>
              色のついた県をタップ → 旅の記録へ。白い県はこれからのお楽しみ。
            </p>
          </div>

          {/* 右: 旅の記録を画鋲で貼ったチェキの壁 */}
          <aside className="japan-side">
            <div className="caption" style={{ marginBottom: 18 }}>RECENT RECORDS</div>
            {jpRecords.length === 0 ? (
              <div className="cheki" style={{ transform: "rotate(-1.5deg)", margin: "0 auto", textAlign: "center" }}>
                <span className="pin" />
                <div style={{ height: 158, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--ink-faint)", color: "var(--ink-faint)", fontSize: 12, lineHeight: 2, padding: "0 16px" }}>
                  まだ一枚もありません
                </div>
                <div className="hand-jp" style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 9, lineHeight: 1.6 }}>
                  旅の写真がここに貼られていきます
                </div>
              </div>
            ) : (
              <div className="cheki-wall">
                {jpRecords.slice(0, 6).map((r, i) => {
                  const tilt = ((parseInt(r.id.replace(/\D/g, "").slice(-3) || "0", 10) % 7) - 3) + (i % 2 ? 0.4 : -0.4);
                  return (
                    <div key={r.id} className="cheki entry"
                      onClick={() => { const p = prefByCode(r.pref_code ?? 0); if (p) { setPref(p); setSpot(r); setView("japan"); } }}
                      style={{ transform: `rotate(${tilt}deg)` }}>
                      <span className="pin" />
                      <Photo rec={r} w={212} h={158} />
                      <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "var(--tsuchi)", marginTop: 9 }}>
                        {r.taken_at ? r.taken_at.replaceAll("-", ".") : "—"}
                        {PREF_EN[r.pref_code ?? 0] ? `  ·  ${PREF_EN[r.pref_code ?? 0]}` : ""}
                      </div>
                      <div className="hand-jp" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginTop: 2, lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {r.name}
                      </div>
                      {r.body && (
                        <div style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {r.body}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
