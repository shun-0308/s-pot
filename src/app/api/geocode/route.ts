import { NextResponse } from "next/server";

// サーバー経由のジオコーディング(OpenStreetMap / Nominatim)。
// ブラウザ直叩きはUA制約やCORSで失敗しやすいため、サーバーから正しいUser-Agentで問い合わせる。
// 利用規約: 1リクエスト/秒・識別可能なUser-Agentが前提。
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("q") ?? "").trim();
  const jpOnly = searchParams.get("jp") === "1";
  if (!raw) return NextResponse.json({ point: null });

  // 郵便番号(〒XXX-XXXX)を除去してNominatimに渡す
  const q = raw.replace(/〒\s*\d{3}-?\d{4}\s*/g, "").trim();
  if (!q) return NextResponse.json({ point: null });

  const params = new URLSearchParams({
    format: "jsonv2",
    q,
    limit: "1",
    "accept-language": "ja",
  });
  if (jpOnly) params.set("countrycodes", "jp");

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        "User-Agent": "S-pot/1.0 (travel atlas; contact: app@example.com)",
        "Accept-Language": "ja",
      },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return NextResponse.json({ point: null }, { status: 200 });
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    let hit = data[0];

    // フォールバック①: 番地・建物番号(全角・半角)を除去して再検索
    if (!hit) {
      const simplified = q
        .replace(/[０-９0-9]+[丁目番号地]?[－\-]?[０-９0-9]*\s*$/, "")
        .trim();
      if (simplified && simplified !== q) {
        const p2 = new URLSearchParams({ format: "jsonv2", q: simplified, limit: "1", "accept-language": "ja" });
        if (jpOnly) p2.set("countrycodes", "jp");
        const res2 = await fetch(`https://nominatim.openstreetmap.org/search?${p2}`, {
          headers: { "User-Agent": "S-pot/1.0 (travel atlas; contact: app@example.com)", "Accept-Language": "ja" },
        });
        if (res2.ok) {
          const data2 = (await res2.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
          hit = data2[0];
        }
      }
    }

    const point = hit
      ? { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), display: hit.display_name }
      : null;
    return NextResponse.json({ point });
  } catch {
    return NextResponse.json({ point: null }, { status: 200 });
  }
}
