"use client";

import { useEffect, useRef } from "react";
import type * as LType from "leaflet";
import type { RecordWithPhotos } from "@/lib/records";

type Props = {
  records: RecordWithPhotos[];
  onSelect: (rec: RecordWithPhotos) => void;
};

const PIN_HTML = `<div style="width:22px;height:22px;border-radius:50%;background:#B23A24;border:2px solid #F7F5EF;box-shadow:0 1px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#F7F5EF;font-size:10px;font-weight:700;font-family:serif;">印</div>`;

// みんなの図鑑: 共有記録を世界地図上にピン表示。クリックで詳細へ。
export default function SharedMap({ records, onSelect }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !divRef.current || mapRef.current) return;

      const map = L.map(divRef.current, { zoomControl: true });
      map.attributionControl.setPrefix(false);
      map.setView([35, 137], 4); // 日本中心で初期表示
      mapRef.current = map;

      // CartoDB Positron: シンプルで明るいタイル
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
      }).addTo(map);

      const withGps = records.filter((r) => r.lat != null && r.lng != null);
      for (const r of withGps) {
        const icon = L.divIcon({
          className: "",
          html: PIN_HTML,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        const marker = L.marker([r.lat!, r.lng!], { icon, title: r.name }).addTo(map);
        marker.bindTooltip(r.name, { direction: "top", offset: L.point(0, -12) });
        marker.on("click", () => onSelectRef.current(r));
      }

      if (withGps.length) {
        const bounds = L.latLngBounds(withGps.map((r) => [r.lat!, r.lng!] as [number, number]));
        map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", border: "1px solid var(--hairline)", marginBottom: 18 }}>
      <div ref={divRef} style={{ height: 280, width: "100%", background: "#EDEDEA", zIndex: 0 }} />
    </div>
  );
}
