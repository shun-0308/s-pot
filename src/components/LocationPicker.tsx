"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as LType from "leaflet";
import { addBaseLayers, MAX_ZOOM } from "@/lib/tiles";

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
  /** ピン未設定のとき、この地域(都道府県名/国名)まで寄せておく */
  focusHint?: string | null;
  jpOnly?: boolean;
  /** 外から座標が入ったときに寄せるズーム。エリアの代表点は広め(15)にして微調整を促す */
  focusZoom?: number;
};

const PIN_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="39" viewBox="0 0 22 30" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 19 11 19s11-10.7 11-19C22 4.9 17.1 0 11 0z" fill="#B23A24"/><circle cx="11" cy="10.5" r="4.2" fill="white" fill-opacity="0.95"/></svg>`;

// ピンを置いたときに最低これくらいは寄る(ズーム4のままだと1タップの誤差が数kmになる)
const WORK_ZOOM = 17;
// これ未満のズームだと「正確な位置」とは言えないので注意書きを出す
const PRECISE_ZOOM = 15;

const round6 = (n: number) => +n.toFixed(6);

// 記録の位置を地図上で指定するピッカー。
// 位置の決め方は3通り —
//   ① 地図の中央十字に合わせて「中央に置く」(指が地図を隠さないので一番正確)
//   ② 地図をタップして設置
//   ③ 置いたピンをドラッグして微調整
// 住所検索の結果(親が lat/lng を更新)にも追従する。
export default function LocationPicker({ lat, lng, onChange, height = 320, focusHint = null, jpOnly = true, focusZoom }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const LRef = useRef<typeof LType | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // このコンポーネント自身が起こした変更を覚えておく。
  // これを更新し忘れると「自分のドラッグ」を外部変更と誤認して
  // 地図が毎回ズーム14で飛んでしまい、微調整ができなくなる。
  const selfSet = useRef<string>("");

  // 地域へのオート寄せが、ユーザーの操作を追い越して上書きしないようにする
  const touched = useRef(false);

  const [zoom, setZoom] = useState<number>(5);
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // 自分発の変更を親へ通知する(外部変更と誤認されないよう先に印をつける)
  const commit = useCallback((la: number, ln: number) => {
    const a = round6(la), b = round6(ln);
    selfSet.current = `${a},${b}`;
    onChangeRef.current(a, b);
  }, []);

  const placeMarker = useCallback((L: typeof LType, map: LType.Map, la: number, ln: number) => {
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
      return;
    }
    const icon = L.divIcon({ className: "", html: PIN_HTML, iconSize: [30, 39], iconAnchor: [15, 39] });
    const m = L.marker([la, ln], { icon, draggable: true, autoPan: true, keyboard: false });
    m.on("dragend", () => {
      const p = m.getLatLng();
      commit(p.lat, p.lng); // ← ここで印をつけるので地図は飛ばない
    });
    m.addTo(map);
    markerRef.current = m;
  }, [commit]);

  // ── 初期化(マウント時1回) ──
  useEffect(() => {
    let alive = true;
    let ro: ResizeObserver | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!alive || !divRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(divRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        maxZoom: MAX_ZOOM,
      });
      map.attributionControl.setPrefix(false);
      mapRef.current = map;

      addBaseLayers(L, map, "pale");

      if (lat != null && lng != null) {
        map.setView([lat, lng], WORK_ZOOM);
        placeMarker(L, map, lat, lng);
        selfSet.current = `${round6(lat)},${round6(lng)}`;
      } else {
        map.setView([36, 138], jpOnly ? 5 : 3); // 日本全体 / 世界
        // 県名・国名が分かっていれば、そこまで寄せておく(毎回日本全体から探さずに済む)
        if (focusHint) {
          fetch(`/api/geocode?q=${encodeURIComponent(focusHint)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              const pt = d?.point;
              // すでにユーザーが操作/ピン設置していたら邪魔しない
              if (pt && alive && mapRef.current && !markerRef.current && !touched.current) {
                mapRef.current.setView([pt.lat, pt.lon], 10);
              }
            })
            .catch(() => {});
        }
      }

      // タップでピンを設置・移動(寄っていなければ同時に寄る)
      map.on("click", (e: LType.LeafletMouseEvent) => {
        const la = round6(e.latlng.lat);
        const ln = round6(e.latlng.lng);
        placeMarker(L, map, la, ln);
        commit(la, ln);
        if (map.getZoom() < PRECISE_ZOOM) map.flyTo([la, ln], WORK_ZOOM, { duration: 0.6 });
      });

      map.on("zoomend", () => setZoom(map.getZoom()));
      map.on("movestart zoomstart", () => { touched.current = true; });
      setZoom(map.getZoom());
      setReady(true);

      // モーダルのスライド等でサイズが変わってもタイルがずれないように追従
      ro = new ResizeObserver(() => { if (alive && mapRef.current) mapRef.current.invalidateSize(); });
      ro.observe(divRef.current);
      requestAnimationFrame(() => { if (alive && mapRef.current) mapRef.current.invalidateSize(); });
    })();

    return () => {
      alive = false;
      ro?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 親が lat/lng を外から変えたとき(住所検索など)だけ地図を動かす ──
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (lat == null || lng == null) {
      // 「クリア」されたらピンも消す
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
      selfSet.current = "";
      return;
    }

    const key = `${round6(lat)},${round6(lng)}`;
    if (key === selfSet.current) {
      // 自分のタップ/ドラッグが返ってきただけ。ピン位置だけ合わせて地図は動かさない。
      placeMarker(L, map, lat, lng);
      return;
    }
    selfSet.current = key;
    placeMarker(L, map, lat, lng);
    // エリアの代表点(focusZoom が小さい)のときは、寄りすぎると周りが見えず
    // 「本当の場所」を探せないので、指定されたズームをそのまま使う。
    const z = focusZoom ?? WORK_ZOOM;
    map.flyTo([lat, lng], focusZoom != null ? z : Math.max(map.getZoom(), z), { duration: 0.7 });
  }, [lat, lng, placeMarker, focusZoom]);

  // ── 操作ボタン ──
  const putAtCenter = () => {
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    const c = map.getCenter();
    placeMarker(L, map, c.lat, c.lng);
    commit(c.lat, c.lng);
    if (map.getZoom() < PRECISE_ZOOM) map.flyTo(c, WORK_ZOOM, { duration: 0.6 });
    setNote(null);
  };

  const backToPin = () => {
    const map = mapRef.current, m = markerRef.current;
    if (!map || !m) return;
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), WORK_ZOOM), { duration: 0.6 });
  };

  const goToMyLocation = () => {
    const map = mapRef.current;
    if (!map || !navigator.geolocation) { setNote("この端末では現在地を取得できません"); return; }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        map.flyTo([pos.coords.latitude, pos.coords.longitude], WORK_ZOOM, { duration: 0.8 });
        setNote("現在地へ移動しました。中央の十字を合わせて「中央に置く」を押してください");
      },
      () => { setLocating(false); setNote("現在地を取得できませんでした（位置情報の許可をご確認ください）"); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const hasPin = lat != null && lng != null;
  const coarse = ready && zoom < PRECISE_ZOOM;

  return (
    <div>
      <div style={{ position: "relative", width: "100%", height, overflow: "hidden", background: "#EDEDEA", border: "1px solid var(--hairline)" }}>
        <div ref={divRef} style={{ position: "absolute", inset: 0 }} />

        {/* 中央の照準。指で地図を隠さずに正確な一点を決められる */}
        <div aria-hidden style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 500 }}>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="12" fill="none" stroke="#0B0E14" strokeOpacity="0.35" strokeWidth="3" />
            <circle cx="23" cy="23" r="12" fill="none" stroke="#F7F5EF" strokeOpacity="0.95" strokeWidth="1.4" />
            <line x1="23" y1="1" x2="23" y2="12" stroke="#F7F5EF" strokeWidth="1.4" />
            <line x1="23" y1="34" x2="23" y2="45" stroke="#F7F5EF" strokeWidth="1.4" />
            <line x1="1" y1="23" x2="12" y2="23" stroke="#F7F5EF" strokeWidth="1.4" />
            <line x1="34" y1="23" x2="45" y2="23" stroke="#F7F5EF" strokeWidth="1.4" />
            <circle cx="23" cy="23" r="1.8" fill="#B23A24" />
          </svg>
        </div>

        {/* ズームが浅いと1タップの誤差が大きいので警告 */}
        {coarse && (
          <div style={{ position: "absolute", left: 8, bottom: 8, zIndex: 500, background: "rgba(11,14,20,0.78)", color: "#F1ECE0", fontSize: 11, padding: "5px 9px", borderRadius: 4, letterSpacing: "0.03em", pointerEvents: "none" }}>
            もう少し拡大すると正確に置けます
          </div>
        )}
      </div>

      {/* 操作ボタン */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
        <button type="button" onClick={putAtCenter} style={btnPrimary}>
          ◎ 中央にピンを置く
        </button>
        <button type="button" onClick={goToMyLocation} disabled={locating} style={{ ...btn, opacity: locating ? 0.6 : 1 }}>
          {locating ? "取得中…" : "現在地へ"}
        </button>
        {hasPin && (
          <button type="button" onClick={backToPin} style={btn}>
            ピンへ戻る
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-faint)", marginTop: 5, lineHeight: 1.75 }}>
        地図を動かして<b>中央の十字</b>を目的地に合わせ「中央にピンを置く」／<b>タップ</b>で直接設置／置いたピンは<b>ドラッグ</b>で微調整できます。
        {hasPin && (
          <>
            <br />
            <span style={{ color: "var(--shu)" }}>現在のピン: {lat!.toFixed(6)}, {lng!.toFixed(6)}</span>
          </>
        )}
      </div>
      {note && <div style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.6 }}>{note}</div>}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "7px 12px", fontSize: 11.5, fontFamily: "inherit", cursor: "pointer",
  border: "1px solid var(--hairline)", background: "transparent", color: "var(--ink-soft)",
  letterSpacing: "0.04em", minHeight: 0, borderRadius: 3,
};

const btnPrimary: React.CSSProperties = {
  ...btn, borderColor: "var(--shu)", color: "var(--shu)", fontWeight: 600,
};
