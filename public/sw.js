// S-pot 最小サービスワーカー: アプリの殻をキャッシュしてオフラインでも開けるように。
// 外部(Supabase/署名付き写真URL/Nominatim)はキャッシュせず素通し。
// ※ デプロイで中身を更新したいときは、この CACHE の版番号(v2→v3...)を上げると
//   旧キャッシュが破棄され、利用者の画面が確実に新しくなる。
const CACHE = "s-pot-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部はそのまま
  if (url.pathname.startsWith("/api/")) return; // APIは常に最新

  // 画面遷移: ネットワーク優先、失敗したらキャッシュ
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // 同一オリジンの静的アセット: キャッシュ優先
  e.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
