import { NextResponse } from "next/server";

// サーバー経由のジオコーディング(OpenStreetMap / Nominatim)。
// ブラウザ直叩きはUA制約やCORSで失敗しやすいため、サーバーから正しいUser-Agentで問い合わせる。
// 利用規約: 1リクエスト/秒・識別可能なUser-Agentが前提。
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const jpOnly = searchParams.get("jp") === "1";
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
      // 県判定の補助用途。少し古くてもよいのでキャッシュを許可
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return NextResponse.json({ point: null }, { status: 200 });
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const hit = data[0];
    const point = hit
      ? { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), display: hit.display_name }
      : null;
    return NextResponse.json({ point });
  } catch {
    return NextResponse.json({ point: null }, { status: 200 });
  }
}
