"use client";

import { useEffect, useRef } from "react";
import type * as LType from "leaflet";

type Props = {
  lat: number;
  lng: number;
  name: string;
  dark?: boolean; // SpotDetail はダーク背景
};

const PIN_HTML = `<div style="width:24px;height:24px;border-radius:50%;background:#B23A24;border:2px solid #F7F5EF;box-shadow:0 2px 8px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;color:#F7F5EF;font-size:11px;font-weight:700;font-family:serif;">印</div>`;

// 単一スポットの埋め込みミニマップ
export default function SpotMap({ lat, lng, name, dark = false }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !divRef.current || mapRef.current) return;

      const map = L.map(divRef.current, { zoomControl: true, scrollWheelZoom: false });
      map.attributionControl.setPrefix(false);
      map.setView([lat, lng], 13);
      mapRef.current = map;

      const tileUrl = dark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(tileUrl, {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: PIN_HTML,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([lat, lng], { icon, title: name }).addTo(map)
        .bindTooltip(name, { direction: "top", offset: L.point(0, -12), permanent: false });

      // スライドアニメーション等でコンテナサイズが変わる間 invalidateSize を呼び続ける
      const ro = new ResizeObserver(() => { if (!cancelled) map.invalidateSize(); });
      if (divRef.current) ro.observe(divRef.current);
      setTimeout(() => ro.disconnect(), 1000);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: 200, overflow: "hidden",
      border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "var(--hairline)"}` }}>
      <div ref={divRef}
        style={{ position: "absolute", inset: 0, background: dark ? "#1a1a20" : "#EDEDEA" }} />
    </div>
  );
}
