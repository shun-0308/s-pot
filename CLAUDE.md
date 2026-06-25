# S-pot プロジェクト メモ（Claude用）

このファイルは、新しいセッションでも毎回ゼロから探さずに済むようにするための説明書です。
Claudeはセッション開始時にこれを読みます。瞬さんへ：内容は自由に直してください。

## これは何のプロジェクト？

**S-pot** — 旅の記録を地図に変える「旅と写真の旅図鑑」アプリ。
Next.js（App Router / TypeScript）+ Supabase + Stripe決済。Vercelで `https://s-pot.vercel.app` に公開。
作者: 松本瞬。

## フォルダの場所

- このプロジェクト本体: `/Users/shunmatsumoto/Documents/s-pot`
- アプリ本体コード: `src/`（`src/app/page.tsx` がトップ、`src/components/` にUI）
- DBスキーマ: `supabase/migrations/`

## LP（ランディングページ）について ← よく見たいやつ

- ファイル: **`lp.html`**（リポジトリ直下）と **`public/lp.html`**（同じ内容。Next経由で `/lp.html` で配信）
- デザイン: ダークな金×紺の世界観。「旅の記録が、あなたの地図になる。」
- **プレビュー方法**: ブラウザで `lp.html` を開く。
  Claudeなら macOS の `open` コマンドで開ける（`open '/Users/shunmatsumoto/Documents/s-pot/lp.html'`）。
  ※ Chrome拡張ツールは `file://` を開けない（`https://` を強制してしまう）ので `open` を使う。

## ⚠️ LPの写真が「読み込めない」問題（既知）

- `lp.html` は `hero.png` / `startrail.jpg` / `sunset.png` / `IMG_7802〜7805.PNG` /
  `IMG_7665/7929/7930/7933` / `slab-hero/tools/works.jpg` / `4B98165A-...JPEG` を参照しているが、
  **これらの画像ファイルはリポジトリにもgit履歴にも存在しない**（一度もコミットされていない）。
  だから写真が表示されない。`.gitignore` のせいではない（画像は無視されていない）。
- 現在フォルダにある使える画像: `public/lp-assets/` の
  `app-globe.jpg` `app-japan-map.jpg` `app-log.jpg` `app-record.jpg` `image.PNG` `image２.PNG` `image３.PNG`

### 恒久対応の手順（写真を二度と行方不明にしない）

1. 瞬さんが元写真を **`lp-src/`** フォルダに入れる（`lp-src/README.md` にスロット対応表あり）
2. Claudeが内容を見て各スロットに割り当て、**`public/lp-assets/` に分かりやすい名前でコピー**
   （`IMG_7802.PNG` → `screen-globe.png` 等。対応表は `lp-src/README.md`）
3. `lp.html` と `public/lp.html` の `src=` / `url()` を新パスに書き換え
4. **git にコミット**して画像をバージョン管理下に置く（→ 環境が変わっても消えない）

## お気に入り機能・プロフィール（2026-06-25 実装）

### お気に入り（♡）
- 状態は **`page.tsx` の `favoriteIds`（全ID）と `favoriteRecords`（記録本体）** に集約。
  `handleToggleFavorite(rec, next)` で楽観更新し、SpotDetail / ログ一覧 / みんなの図鑑 /
  メニューのすべてが同じstateを共有する（＝どこで♡しても即メニューに反映される）。
- メニューのお気に入り一覧は `favoriteRecords` を直接表示。自分の記録だけでなく、
  **みんなの図鑑で付けた他人の記録**も `fetchFavoriteRecords()`（favorites→records結合）で出る。
- `FavoriteButton` は各所で再有効化済み（以前はバグ回避でコメントアウトされていた）。

### 地球のタッチ貫通バグ
- 原因: メニュー表示中もGlobeViewのwindowレベルpointer監視が生き、タッチのキャンセル等で
  掴み状態が残ると、メニュー上のタップ位置で地球が反応していた。
- 対策: `GlobeView` に **`interactive` prop**（page側で `!menuOpen && !profileOpen`）を追加。
  非表示中はhudの `pointerEvents:none` + 各ハンドラで早期return。さらに `pointercancel` で
  掴み状態を確実にリセット。

### プロフィール欄
- `profiles` に `bio / area / instagram / website / gear` 列を追加（migration `0007`）。
- 編集は `ProfileSettings`、他ユーザーの表示は `UserProfileModal`。

### プロフィールの世界観刷新＋顔写真（2026-06-25）
- 見た目を**ダークな金×紺のアトラス調**に統一（`ProfileSettings` / `UserProfileModal`）。
  金アクセントは `#C9A86A`〜`#E3C58C`。地球画面と同じ重厚な世界観。
- 顔写真（アバター）対応。**公開バケット `avatars`**（migration `0008`）に保存し、
  `profiles.avatar_path` にパスを持つ。URL生成・アップロードは `src/lib/profiles.ts`
  （`avatarUrl()` / `uploadAvatar()`、画像は512pxにリサイズ）。
- みんなの図鑑（`SharedFeed`）の投稿者アイコンも、顔写真があれば金リングで表示。
  `fetchSharedRecords()` が `avatar_path` も返す。
- 注意: `avatars` は**公開バケット**（URLを知れば誰でも閲覧可）。顔写真を公開する前提の仕様。
- 顔写真は選択後に **`AvatarCropper`**（丸マスク・ドラッグで位置合わせ＋スライダー拡大）で
  位置を調整 → 512px正方形に切り抜いて保存。`uploadAvatar()` は切り抜き済みBlobを受け取る。

## 位置情報・手動ピン（2026-06-25 実装）

### 仕組み
- 記録の座標は **`RecordForm` の `lat/lng`（FormValues）** が単一の真実。
  作成/更新時の座標優先順は **① 手動ピン → ② 写真のGPS → ③ 住所/名前のジオコーディング**。
- 手動ピンは **`LocationPicker`（Leaflet・ドラッグ可能マーカー）**。地図タップで設置、
  ドラッグで微調整。「住所/名前で検索」で候補位置に置いてから直せる。
- ジオコーディングは `page.tsx` の `geocodeForRecord()` に集約。**都道府県名の二重付与を回避**
  （住所そのまま→住所+県→名前+県→名前 の順で試行）。

### 住所・場所検索（候補リスト方式・2026-06-25）
- `RecordForm` の「住所/名前で検索」は、複数候補を一覧表示して**タップで選んでピン設置**
  （Googleマップの検索窓に近いUX）。山名でも候補が出る。
- ジオコーダは `src/app/api/geocode/route.ts` に集約。優先順位:
  **① `GOOGLE_MAPS_API_KEY` があればGoogle Places Text Search → ② Photon(OSM・名前検索に強い) → ③ Nominatim**。
  Googleに上げたいときは Vercel の環境変数に `GOOGLE_MAPS_API_KEY` を入れるだけで自動切替。
- フロントは `geocodeCandidates()`（複数候補）/ `geocodePlace()`（単一・自動補完用）。

### なぜ前は地図に出なかったか
- Nominatim(無料地図)は日本の字(あざ)レベルの住所データが無いことが多く、正しい住所でも空振りする。
- 旧実装は自動補完(backfill)が「自分の記録」だけ対象で、テスター投稿は作成時の一発勝負だった。
- → 手動ピンで地図データの穴を確実に埋められるようにした。

### 公開時の位置表示について
- みんなの図鑑のマップはピン座標をそのまま表示する。`RecordForm` の注記も
  「公開するとこのピンの場所が地図に出る／嫌ならピンをずらすか自分だけに」と実態に合わせて修正済み。

## メモの運用

何か決まった事・直した事があれば、このファイルに追記していくと次回スムーズです。
