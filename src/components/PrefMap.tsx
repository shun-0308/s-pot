"use client";

import { useEffect, useRef } from "react";
import type * as LType from "leaflet";
import type { RecordWithPhotos } from "@/lib/records";

type Props = {
  bounds: [[number, number], [number, number]]; // [[南,西],[北,東]]
  records: RecordWithPhotos[];
  onSelect: (rec: RecordWithPhotos) => void;
};

const GSI = "https://cyberjapandata.gsi.go.jp/xyz";
const ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>';

// 県内拡大マップ(地理院 淡色地図)。市町村レベルまでズーム可、GPS付き記録をピン表示
export default function PrefMap({ bounds, records, onSelect }: Props) {
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
      map.fitBounds(bounds, { padding: [12, 12] });

      L.tileLayer(`${GSI}/pale/{z}/{x}/{y}.png`, {
        maxZoom: 18,
        attribution: ATTR,
      }).addTo(map);
      mapRef.current = map;

      // 記録ピン(朱印風)
      const withGps = records.filter((r) => r.lat != null && r.lng != null);
      for (const r of withGps) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:24px;height:24px;border-radius:50%;background:#B23A24;border:2px solid #F7F5EF;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#F7F5EF;font-size:11px;font-weight:700;font-family:'Shippori Mincho B1',serif;">印</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const m = L.marker([r.lat!, r.lng!], { icon, title: r.name }).addTo(map);
        m.bindTooltip(r.name, { direction: "top", offset: L.point(0, -12) });
        m.on("click", () => onSelectRef.current(r));
      }
      if (withGps.length) {
        const fb = L.latLngBounds(withGps.map((r) => [r.lat!, r.lng!] as [number, number]));
        map.fitBounds(fb.pad(0.35), { maxZoom: 13 });
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
    <div style={{ position: "relative", border: "1px solid var(--hairline)" }}>
      <div ref={divRef} style={{ height: 360, width: "100%", background: "#EDEDEA", zIndex: 0 }} />
    </div>
  );
}
