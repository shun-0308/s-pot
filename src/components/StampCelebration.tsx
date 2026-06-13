"use client";

import { useEffect } from "react";

type Props = { prefName: string; no: number; first: boolean; onDone: () => void };

// 保存時の演出: 朱印がドンと押される。新しい県なら一言添える。
export default function StampCelebration({ prefName, no, first, onDone }: Props) {
  useEffect(() => {
    const t = setTimeout(onDone, first ? 2600 : 2000);
    return () => clearTimeout(t);
  }, [onDone, first]);

  return (
    <div onClick={onDone}
      style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(30,28,25,0.38)", animation: `stampFade ${first ? 2.6 : 2}s ease both`, cursor: "pointer" }}>
      {first && (
        <div className="caption" style={{ color: "#F7F5EF", marginBottom: 20, fontSize: 11, letterSpacing: "0.45em", animation: "stampRise .6s .5s ease both" }}>
          NEW PREFECTURE
        </div>
      )}

      <div style={{ width: 170, height: 170, borderRadius: "50%", border: "3px solid #9A7B5F", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(247,245,239,0.97)", transform: "rotate(-7deg)", animation: "stampIn .55s cubic-bezier(.2,1.65,.35,1) .12s both" }}>
        <div style={{ width: 142, height: 142, borderRadius: "50%", border: "1.5px solid #9A7B5F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#9A7B5F", fontSize: 9, letterSpacing: "0.32em" }}>S-POT</div>
          <div className="tz-serif" style={{ color: "#9A7B5F", fontSize: 27, fontWeight: 700, letterSpacing: "0.08em", margin: "3px 0", whiteSpace: "nowrap" }}>
            {prefName}
          </div>
          <div style={{ color: "#9A7B5F", fontSize: 11, letterSpacing: "0.22em" }}>記録 第{no}号</div>
        </div>
      </div>

      {first && (
        <div className="tz-serif" style={{ color: "#F7F5EF", fontSize: 14, marginTop: 22, letterSpacing: "0.25em", animation: "stampRise .6s .55s ease both" }}>
          新しい県がひらきました
        </div>
      )}

      <style>{`
        @keyframes stampIn { from { transform: rotate(-7deg) scale(2.5); opacity: 0 } 55% { opacity: 1 } to { transform: rotate(-7deg) scale(1); opacity: 1 } }
        @keyframes stampRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        @keyframes stampFade { 0% { opacity: 0 } 7% { opacity: 1 } 84% { opacity: 1 } 100% { opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important } }
      `}</style>
    </div>
  );
}
