"use client";

import { useEffect, useRef } from "react";
import type * as LType from "leaflet";

type Props = {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  height?: number;
};

const PIN_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 22 30" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 19 11 19s11-10.7 11-19C22 4.9 17.1 0 11 0z" fill="#B23A24"/><circle cx="11" cy="10.5" r="4.2" fill="white" fill-opacity="0.95"/></svg>`;

// 記録の位置を地図上で手動指定するピッカー。
// タップで設置、ドラッグで微調整。住所検索の結果(親が lat/lng を更新)にも追従する。
export default function LocationPicker({ lat, lng, onChange, height = 260 }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markerRef = useRef<LType.Marker | null>(null);
  const LRef = useRef<typeof LType | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // 親 → 地図 の反映と、地図 → 親 の通知が往復ループしないよう、最後に外部から受けた値を覚えておく
  const lastExternal = useRef<string>("");

  const placeMarker = (L: typeof LType, map: LType.Map, la: number, ln: number) => {
    const icon = L.divIcon({ className: "", html: PIN_HTML, iconSize: [26, 34], iconAnchor: [13, 34] });
    if (markerRef.current) {
      markerRef.current.setLatLng([la, ln]);
    } else {
      const m = L.marker([la, ln], { icon, draggable: true });
      m.on("dragend", () => {
        const p = m.getLatLng();
        onChangeRef.current(+p.lat.toFixed(6), +p.lng.toFixed(6));
      });
      m.addTo(map);
      markerRef.current = m;
    }
  };

  // 初期化(マウント時1回)
  useEffect(() => {
    let alive = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!alive || !divRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(divRef.current, { zoomControl: true });
      map.attributionControl.setPrefix(false);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      if (lat != null && lng != null) {
        map.setView([lat, lng], 14);
        placeMarker(L, map, lat, lng);
        lastExternal.current = `${lat},${lng}`;
      } else {
        map.setView([36, 138], 4); // 日本全体
      }

      // タップ/クリックでピンを設置・移動
      map.on("click", (e: LType.LeafletMouseEvent) => {
        const la = +e.latlng.lat.toFixed(6);
        const ln = +e.latlng.lng.toFixed(6);
        placeMarker(L, mapRef.current!, la, ln);
        lastExternal.current = `${la},${ln}`;
        onChangeRef.current(la, ln);
      });

      requestAnimationFrame(() => { if (alive && mapRef.current) mapRef.current.invalidateSize(); });
    })();

    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 親が lat/lng を外部から変えたとき(住所検索など)に地図へ反映
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || lat == null || lng == null) return;
    const key = `${lat},${lng}`;
    if (key === lastExternal.current) return; // 自分の通知が返ってきただけなら無視
    lastExternal.current = key;
    placeMarker(L, map, lat, lng);
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
  }, [lat, lng]);

  return (
    <div
      ref={divRef}
      style={{ width: "100%", height, position: "relative", overflow: "hidden", background: "#EDEDEA", border: "1px solid var(--hairline)" }}
    />
  );
}
