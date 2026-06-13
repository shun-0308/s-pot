"use client";

import { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import Photo from "./Photo";
import RecordForm, { type FormValues } from "./RecordForm";
import { type RecordWithPhotos } from "@/lib/records";
import type { Country } from "@/lib/world";

type Props = {
  country: Country;
  records: RecordWithPhotos[];
  adding: boolean;
  autoMsg: string | null;
  formInitial: Partial<FormValues> | undefined;
  busy: boolean;
  onBack: () => void;
  onSelectSpot: (rec: RecordWithPhotos) => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onCreate: (v: FormValues) => void;
};

export default function CountryPage({
  country, records, adding, autoMsg, formInitial, busy,
  onBack, onSelectSpot, onStartAdd, onCancelAdd, onCreate,
}: Props) {
  // 国シルエット(ミニ)
  const silhouette = useMemo(() => {
    const proj = geoMercator();
    proj.fitSize([110, 110], country.feature as never);
    return geoPath(proj)(country.feature as never) ?? "";
  }, [country]);

  const cap = (takenAt: string | null) =>
    `${country.name.toUpperCase()}${takenAt ? ` — ${takenAt.replaceAll("-", ".")}` : ""}`;

  return (
    <div style={{ padding: "26px 20px 70px" }}>
      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <button onClick={onBack}
          style={{ background: "none", border: "none", color: "var(--ink-faint)", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit", letterSpacing: "0.1em" }}>
          ← 地球へ
        </button>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 20, margin: "20px 0 8px" }}>
          <svg viewBox="0 0 110 110" style={{ width: 92, height: 92, flexShrink: 0 }}>
            <path d={silhouette} fill="#B23A24" />
          </svg>
          <div style={{ paddingBottom: 4 }}>
            <div className="caption">WORLD ATLAS</div>
            <h2 className="tz-serif" style={{ fontSize: 27, fontWeight: 700, margin: "2px 0 0", letterSpacing: "0.06em" }}>
              {country.name}
            </h2>
            <div style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6, letterSpacing: "0.08em" }}>
              {records.length ? `記録 ${records.length} 件` : "まだ記録がありません"}
            </div>
          </div>
        </div>

        {autoMsg && adding && (
          <div className="card" style={{ borderLeft: "2px solid var(--shu)", padding: "8px 14px", fontSize: 12.5, color: "var(--shu)", margin: "16px 0 0", lineHeight: 1.7 }}>
            {autoMsg}
          </div>
        )}

        <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 18 }}>
          {records.map((r) => (
            <div key={r.id} onClick={() => onSelectSpot(r)} className="entry"
              role="button" tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSelectSpot(r)}
              style={{ padding: "22px 0", borderBottom: "1px solid var(--hairline)" }}>
              <Photo rec={r} h={210} />
              <div className="caption" style={{ marginTop: 12 }}>{cap(r.taken_at)}</div>
              <div className="tz-serif" style={{ fontSize: 17.5, fontWeight: 700, lineHeight: 1.5, marginTop: 3 }}>
                {r.name}
              </div>
              {r.body && (
                <div style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 2, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                  {r.body}
                </div>
              )}
            </div>
          ))}
        </div>

        {adding ? (
          <div style={{ marginTop: 22 }}>
            <RecordForm title={`${country.name}の記録`} initial={formInitial} busy={busy}
              onSubmit={onCreate} onCancel={onCancelAdd} />
          </div>
        ) : (
          <button onClick={onStartAdd}
            style={{ width: "100%", padding: 15, marginTop: 24, border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.14em" }}>
            ＋ 記録を追加する
          </button>
        )}
      </div>
    </div>
  );
}
