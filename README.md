# S-pot — 旅の図鑑

日本地図から県をタップして、自分が撮った写真と記録文が読める「自分だけの観光図鑑」。
詳細は『旅の図鑑 立ち上げ仕様書』を参照。

## 技術スタック

Next.js + TypeScript + Tailwind CSS / Supabase (Auth・Postgres・Storage)

## 開発

```bash
npm install
npm run dev   # http://localhost:3000
```

Supabase接続情報は `.env.local` に設定済み(プロジェクト: s-pot / 東京リージョン)。

## 構成

- `src/app/page.tsx` — 全国地図ビュー(訪問県の色塗り+コンプカウンター)
- `src/components/JapanMap.tsx` — 日本地図SVG(実地形・沖縄インセット・朱印バッジ)
- `src/lib/prefectures.ts` — 47都道府県データ+地域カラー
- `src/lib/geo.ts` — GPS座標→県判定(ray casting+最近傍フォールバック)
- `src/lib/exif.ts` — EXIFパーサ(GPS・撮影日時、外部ライブラリ不要)
- `src/lib/supabase.ts` — Supabaseクライアント+型
- `supabase/migrations/` — 適用済みスキーマ(records / record_photos / RLS / photosバケット)

## Phase 1 — 実装済み(MVP完了)

- メールログイン(Supabase Auth、サインアップ時は確認メールあり)
- 日本地図ビュー(訪問県の色塗り+朱印バッジ+コンプカウンター)
- 写真から自動記録(EXIF→県判定→フォーム自動入力→長辺2000pxリサイズ→アップロード)
- 県ページ(記録一覧)/ 記録詳細 / 手動記録・編集・削除
- GPSなし写真への手動フォールバック案内

## Phase 2 以降(未着手)

- 1記録に複数写真(スワイプギャラリー)/ 県内ピン表示 / 年月フィルタ・検索 / PWA化
- HEIC対応(exifr採用検討)

## S-Lab公開に向けた決定事項

- 退会時: アクセス即停止 → 猶予期間(仮90日)は閲覧・エクスポートのみ → 期限後削除。再入会で復活
- 実装済み: profiles テーブル(membership_status: active/grace/expired)+全RLSにステータス条件
- 未決定: 1人あたり写真枚数上限(公開前に決定)、S-Lab会員リストとの紐づけ方法、エクスポート機能
