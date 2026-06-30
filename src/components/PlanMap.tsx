"use client";

import { useEffect, useRef } from "react";
import type * as LType from "leaflet";

// プランの行き先を「番号つきピン＋順路の線」で地図に表示する。
// スポット同士の位置関係がパッと分かり、無理のない順番か確認できる。
export type PlanPoint = { id: string; name: string; lat: number; lng: number };

type Props = {
  points: PlanPoint[]; // 並び順そのままが順路になる
  onSelect?: (id: string) => void;
  height?: number;
};

const numIcon = (n: number) => `
<div style="width:26px;height:26px;border-radius:50%;background:#B23A24;color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;
  border:2px solid #EDE8DC;box-shadow:0 2px 5px rgba(0,0,0,.4);font-family:Georgia,serif">${n}</div>`;

export default function PlanMap({ points, onSelect, height = 320 }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const layerRef = useRef<LType.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const pointsRef = useRef(points);
  pointsRef.current = points;

  // 初期化(マウント時1回)
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
      layerRef.current = L.layerGroup().addTo(map);
      draw(L);
      requestAnimationFrame(() => {
        if (alive && mapRef.current) mapRef.current.invalidateSize();
      });
    };
    init();
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // points が変わったら描き直す
  useEffect(() => {
    const run = async () => {
      const L = (await import("leaflet")).default;
      if (mapRef.current && layerRef.current) draw(L);
    };
    run();
  }, [points]);

  function draw(L: typeof import("leaflet")) {
    const map = mapRef.current!;
    const layer = layerRef.current!;
    layer.clearLayers();
    const pts = pointsRef.current.filter((p) => p.lat != null && p.lng != null);
    if (!pts.length) {
      map.setView([36, 138], 4);
      return;
    }
    // 順路の線
    if (pts.length > 1) {
      L.polyline(pts.map((p) => [p.lat, p.lng] as [number, number]), {
        color: "#C9A86A", weight: 2.5, opacity: 0.85, dashArray: "1 6", lineCap: "round",
      }).addTo(layer);
    }
    // 番号ピン
    pts.forEach((p, i) => {
      const icon = L.divIcon({ className: "", html: numIcon(i + 1), iconSize: [26, 26], iconAnchor: [13, 13] });
      const m = L.marker([p.lat, p.lng], { icon, title: p.name });
      m.bindTooltip(`${i + 1}. ${p.name}`, { direction: "top", offset: L.point(0, -14) });
      m.on("click", () => onSelectRef.current?.(p.id));
      layer.addLayer(m);
    });
    const bounds = L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.25), { maxZoom: 13 });
  }

  const withCoords = points.filter((p) => p.lat != null && p.lng != null).length;
  const noCoords = points.length - withCoords;

  return (
    <div style={{ borderTop: "1px solid var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
      <div ref={divRef} style={{ width: "100%", height, position: "relative", overflow: "hidden", background: "#EDEDEA" }} />
      {noCoords > 0 && (
        <div style={{ padding: "6px 10px", fontSize: 11, color: "var(--ink-faint)", borderTop: "1px solid var(--hairline)", background: "var(--paper-raise)" }}>
          📍 地図に出せるのは {withCoords} 件（{noCoords} 件は位置未設定）
        </div>
      )}
    </div>
  );
}
