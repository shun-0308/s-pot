"use client";

import { useEffect, useRef } from "react";
import type * as LType from "leaflet";
import type { RecordWithPhotos } from "@/lib/records";

type Props = {
  records: RecordWithPhotos[];
  onSelect: (rec: RecordWithPhotos) => void;
  height?: number;
};

const PIN_HTML = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))"><path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 19 11 19s11-10.7 11-19C22 4.9 17.1 0 11 0z" fill="#B23A24"/><circle cx="11" cy="10.5" r="4.2" fill="white" fill-opacity="0.9"/></svg>`;

export default function SharedMap({ records, onSelect, height = 360 }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const markersRef = useRef<LType.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // records を ref で保持 → async init 内で最新値を読む
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // ── 初期化（マウント時1回。マーカー追加も含む） ──────────────
  useEffect(() => {
    let alive = true;

    const init = async () => {
      const L = (await import("leaflet")).default;
      if (!alive || !divRef.current || mapRef.current) return;

      const map = L.map(divRef.current, { zoomControl: true });
      map.attributionControl.setPrefix(false);
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      markersRef.current = L.layerGroup().addTo(map);

      // レコードは ref 経由で取得（非同期 import 後も最新値を保持）
      const recs = recordsRef.current;
      const withGps = recs.filter((r) => r.lat != null && r.lng != null);

      if (withGps.length) {
        for (const r of withGps) {
          const icon = L.divIcon({ className: "", html: PIN_HTML, iconSize: [22, 30], iconAnchor: [11, 30] });
          const marker = L.marker([r.lat!, r.lng!], { icon, title: r.name });
          marker.bindTooltip(r.name, { direction: "top", offset: L.point(0, -12) });
          marker.on("click", () => onSelectRef.current(r));
          markersRef.current!.addLayer(marker);
        }
        const bounds = L.latLngBounds(withGps.map((r) => [r.lat!, r.lng!] as [number, number]));
        map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
      } else {
        map.setView([36, 138], 4);
      }

      // レイアウト確定後にタイル再計算
      requestAnimationFrame(() => {
        if (alive && mapRef.current) mapRef.current.invalidateSize();
      });
    };

    init();

    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── records が後から変わったときだけピンを更新 ────────────────
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    const update = async () => {
      const L = (await import("leaflet")).default;
      if (!mapRef.current) return;

      markers.clearLayers();
      const withGps = records.filter((r) => r.lat != null && r.lng != null);

      for (const r of withGps) {
        const icon = L.divIcon({ className: "", html: PIN_HTML, iconSize: [22, 30], iconAnchor: [11, 30] });
        const marker = L.marker([r.lat!, r.lng!], { icon, title: r.name });
        marker.bindTooltip(r.name, { direction: "top", offset: L.point(0, -12) });
        marker.on("click", () => onSelectRef.current(r));
        markers.addLayer(marker);
      }

      if (withGps.length) {
        const bounds = L.latLngBounds(withGps.map((r) => [r.lat!, r.lng!] as [number, number]));
        map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
      }
    };

    update();
  }, [records]);

  const withCoords = records.filter((r) => r.lat != null && r.lng != null).length;
  const noCoords = records.length - withCoords;

  return (
    <div style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
      <div
        ref={divRef}
        style={{ width: "100%", height, position: "relative", overflow: "hidden", background: "#EDEDEA" }}
      />
      {noCoords > 0 && (
        <div
          style={{
            padding: "6px 10px",
            fontSize: 11,
            color: "var(--ink-faint)",
            borderTop: "1px solid var(--hairline)",
            background: "var(--paper-raise)",
          }}
        >
          📍 {withCoords}件を表示中（{noCoords}件は座標未取得）
        </div>
      )}
    </div>
  );
}
