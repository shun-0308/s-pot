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

## プロフィール投稿のチェキ表示・つながり（2026-06-25）
- 公開プロフィール（`UserProfileModal`）下部の投稿は、`.cheki`クラスの**チェキ風カード**（画鋲＋傾き）
  を2カラムで表示。ダーク地に白い instant photo が並ぶ世界観。
- サイドメニュー（`SideMenu`）に **CONNECTIONS — つながり** セクションを追加。
  フォロー/フォロワーの件数と一覧（顔写真＋名前）を表示し、タップで `UserProfileModal` を開く。
  一覧は `fetchFollowing()` / `fetchFollowers()`（`src/lib/follows.ts`）。
- 他ユーザーのプロフィールはメニューからも開けるよう、`page.tsx` に `profileUser` state を追加し
  `overlays` で `UserProfileModal` を描画。`SideMenu` の `onOpenUser` で起動。
- `ProfileSettings` のプラン（SUBSCRIPTION）欄は**一番下**へ移動。

## お出かけプラン・クリップ（2026-06-27 実装 / フェーズ1）

行きたいスポットを並べて「旅のしおり」を作る機能。フェーズ1は **作成＋クリップ＋地図確認** を実装。
公開・他人プラン参考・検索はフェーズ2（DBは公開対応済み）。

### データ（migration `0009_plans_and_clips.sql`・本番適用済み）
- **`clips`**: 行きたい場所の保存（wishlist）。♡(favorites=いいね/思い出)とは**別物**。
  既存記録由来（`record_id`）でも、地図/検索で見つけたフリーな場所でも保存可。RLSは本人のみ。
  `(user_id, record_id)` の部分一意index で同じ記録の二重クリップを防止。
- **`plans`**: しおり本体。`title / description / plan_date / visibility(private既定)`。
  RLSは owner全操作＋members/public読み取り（recordsと同じ `owner_active()` 方式）。
- **`plan_items`**: 行き先（`sort`順）。記録由来でもフリーでも可。`name/address/lat/lng/note/planned_time`。
  読みは親plansが読めれば可、書きは親plansの持ち主のみ。

### lib
- `src/lib/clips.ts`: `fetchClips / fetchClippedRecordIds / addClip / removeClip / toggleClipForRecord`。
- `src/lib/plans.ts`: `fetchPlans(件数つき) / fetchPlan(項目つき) / createPlan / updatePlan / deletePlan /
  addPlanItem / updatePlanItem / removePlanItem / reorderPlanItems`。

### UI
- `PlansPage`: プラン一覧＋新規作成（作成後そのまま編集へ）。`SideMenu` の「🚩 お出かけプラン」から。
- `PlanEditor`: タイトル/日付/公開設定の編集、行き先リスト（↑↓並べ替え・削除・メモ/時刻インライン編集）、
  **スポット追加モーダル**（クリップ / 記録(自分＋♡他人) / **日本地図**(県タップ→その県の記録カードから選ぶ) / 検索(geocodeで自由な場所)）。
  日本地図タブは `JapanMap`（counts=選択可能な記録の県別件数）を再利用し、県選択→`Photo`サムネ付きカード一覧。
- **位置の正確性（重要）**: 各プラン項目に「地図で位置を調整」を追加。`LocationPicker`（実OpenStreetMap・
  ドラッグ可能ピン）＋地名検索（`geocodeCandidates`）で**実緯度経度（小数6桁）を必ず確定**できる。
  座標未設定の項目は地図に出さず「位置未設定」と明示（偽座標は置かない）。`saveItemCoords` が
  楽観更新＋`updatePlanItem({lat,lng})`で永続化し、順路マップ`PlanMap`に即反映。
  ジオコーダは `/api/geocode` が **Google Places優先**（`GOOGLE_MAPS_API_KEY` があれば最精度）→Photon→Nominatim。
- `PlanMap`: 番号つきピン＋金色の順路ライン（Leaflet）。`SharedMap` と同じタイル方式。
- `ClipsPage`: クリップ一覧＋地図。「📍 クリップ」メニューから。`SpotDetail` の **🚩ClipButton**（♡の隣）で保存。
- 状態は `page.tsx` の `clips / clippedIds / planId` に集約。♡同様クリップも楽観更新。

### 検証
- `tsc --noEmit` グリーン（プロジェクトの pinned `stripe@22.2.2` で確認）。

## みんなのプラン・写真シェア・おすすめ検索（2026-06-27 実装 / フェーズ2）

フェーズ1のDB（`plans.visibility`）の上に、公開プランの閲覧・検索・複製を実装。

### lib（`src/lib/plans.ts` 追記）
- **`fetchPlans` を自分のみに修正**（重要）。members/public読みRLSがあるため
  `.eq("user_id", 自分)` を入れないと他人の公開プランが「自分のプラン一覧」に混ざる。
- `fetchSharedPlans()`: 他人の members/public プラン一覧。投稿者プロフィール（顔写真）、
  項目数、項目名リスト（検索用）、カバー写真（先頭の記録由来項目の写真）つき。
- `fetchSharedPlan(id)`: 公開プラン1件を読み取り。項目＋写真URL＋投稿者。
- `duplicatePlan(srcId)`: 「このプランを参考にする」。自分のprivateプランとして全項目を複製。
- 写真は `recordPhotoMap()` が記録由来項目の先頭写真を署名URL化（RLSで読めない記録は自然に写真なし）。

### UI
- `SharedPlansPage`: みんなのプラン一覧＋キーワード検索（タイトル/説明/投稿者/行き先名で絞り込み）。
  カバー写真つきカード。「✨ みんなのプラン」メニューから。
- `PlanView`: 公開プランの読み取り専用ビュー。地図＋写真つき行き先＋投稿者。
  「このプランを参考にする」で `duplicatePlan` → 自分の `PlanEditor` へ。
- `PlanEditor`: 公開中（members/public）のとき金色の共有バナーを表示（写真も共有される旨）。
- page.tsx に `shared-plans` / `shared-plan` ビューと `viewPlanId` state を追加。

### 注意・今後（フェーズ3候補）
- 公開プランの「アプリ外で開けるURL」はまだ無い（閲覧はアプリ内ナビのみ）。
  真の共有リンクが欲しければ `/plan/[id]` ルートを足す。

## 記録の公開ページ（非会員も閲覧可 / 2026-09-15 実装）

`visibility=public` の記録を、**ログイン不要の単独ページ `/s/[id]`** で読み取り専用表示できる。

- **DB変更は不要だった**。records / record_photos / storage.objects の SELECT ポリシーが
  既に「`visibility='public'` かつ投稿者active なら**匿名(anon)でも読める**」設計になっていた
  （storage は写真パス `user_id/record_id/...` の `foldername[2]=record_id` で記録の公開判定）。
- `src/app/s/[id]/page.tsx`: アクセスゲート(page.tsx)の外の独立ルート。`fetchPublicRecord(id)`
  （`src/lib/records.ts`・匿名クライアントで取得。非公開はRLSで null）→ `SpotDetail` を
  `isOwner={false}`・♡/クリップ/戻る無しで再利用して表示。非公開/不明なら「公開されていません」。
- `SpotDetail` を公開表示でも安全なよう微修正: `onBack/onUpdate/onDelete` を任意化、♡は
  `onToggleFav` がある時だけ描画（未ログインで押せない）、所有者かつpublicのとき
  **「共有リンクをコピー」ボタン**（`${origin}/s/${id}`）を追加。
- 未実装（今後）: OGP（LINE/X用のリンクプレビュー）。写真は署名URL(期限付き)なので、
  og:image を出すならサーバー側で長期署名URLを発行するルートが要る。

## メモの運用

何か決まった事・直した事があれば、このファイルに追記していくと次回スムーズです。

## ロケハン情報のAI下書き（2026-07-28 実装）

`records.scout`（jsonb / `0005_scout_info.sql`）の各項目を自動で埋めるための仕組み。

### いちばん大事な設計判断：Geminiのgroundingは使わない

Gemini の `googleSearch` / `googleMaps` grounding（＝AIが自分で検索して調べる機能）は、
**無料枠に割り当てが無く、1回目の呼び出しから 429 RESOURCE_EXHAUSTED になる**。
2026-07-28 に実測した結果は以下（`scripts/gemini-probe2.mjs` で再現できる）:

| 試したこと | 結果 |
|---|---|
| モデル一覧の取得 | ✅ 200（50モデル） |
| tools無しの通常生成 | ✅ 200（`gemini-3.5-flash` / `gemini-3.1-flash-lite`） |
| `responseSchema` 構造化出力 | ✅ 200 |
| `googleMaps` grounding | ❌ 429（全モデル） |
| `googleSearch` grounding | ❌ 429（全モデル） |
| `gemini-2.5-flash` / `-lite` | ❌ 404「新規ユーザーには提供終了」 |
| `gemini-2.5-pro` | ❌ 429（toolsを使わなくても＝無料枠が無い） |

429 が**1回目から全モデル一律**で出るので、これは叩きすぎのレート制限ではなく
「無料枠に grounding の割り当てがそもそも0」ということ。使うには課金の有効化が必須。

**なので役割を完全に分けた:**

- **事実（駅・駐車場・トイレ・コンビニ）を取るのは地図API** → `src/lib/nearby.ts`
- **文章にするのは Gemini（tools無し＋responseSchema）** → `src/lib/gemini.ts`

これは単なる回避策ではなく、**AIが駐車場の名前を捏造できなくなる**という利点がある。
実データに載っている固有名詞しか使わないようプロンプトで縛っている。

### ファイル構成

- `src/lib/nearby.ts` — 周辺施設の実データ取得。
  - ① `GOOGLE_MAPS_API_KEY` があれば **Google Places Nearby Search (New)**（精度最高）
  - ② 無ければ **Overpass(OSM)**（無料・キー不要）
  - `geocode/route.ts` と同じ「キーがあれば昇格」方式なので、後からキーを足すだけで精度が上がる。
- `src/lib/gemini.ts` — Gemini呼び出しの薄いラッパ。tools不使用。モデルは
  `gemini-3.5-flash` → `gemini-3.1-flash-lite` → `gemini-3-flash-preview` の順にフォールバック。
- `src/lib/scout-ai.ts` — 実データ＋撮影知識から `ScoutDraft` を生成。
- `src/app/api/scout/route.ts`
  - `GET  /api/scout?lat=..&lng=..` → 周辺の実データだけ（Gemini不使用・完全無料）
  - `POST /api/scout {lat,lng,name,address?,season?}` → 実データ＋AI下書き
  - Geminiが失敗しても**周辺データだけは200で返す**（UIは「AIは失敗、施設情報は表示」にできる）

### ⚠️ Overpass(OSM)を使うときの落とし穴

- **POST + User-Agent無し だと 406 が返る。必ず GET + User-Agent を付ける。**（ここで一度ハマった）
- 公開サーバーは混雑時に **429 / 504** を普通に返す。ミラー3つ＋リトライで粘り、
  それでもダメなら空配列を返してアプリは落とさない設計にしてある。
- `overpass.osm.ch` はスイス限定データなので日本では0件。使わないこと。
- 施設の種類は1リクエストにまとめて投げている（公開サーバーへの負荷とレート制限対策）。

### 動作確認

```bash
node scripts/scout-e2e.mjs     # 浅草寺で 実データ取得 → AI下書き まで通す
node scripts/gemini-probe2.mjs # モデル×tools の可否マトリクスを再測定
```

2026-07-28 の実行結果: 浅草寺で駅3件・駐車場6件（パークジャパン/タイムズ/リパーク/ナガハマ）等を
OSMから取得し、`gemini-3.5-flash` が実在の施設名だけを使った下書きを生成。捏造チェックも通過。

### 次にやると良いこと

1. **`GOOGLE_MAPS_API_KEY` を `.env.local` に追加**する（`/api/geocode` の精度も同時に上がる）。
   Google Maps Platform は月ごとの無料呼び出し枠があり、このアプリの規模なら実質無料の見込み。
2. **結果のキャッシュ**。同じスポットを開くたびに外部APIを叩くと、無料枠もOverpassも保たない。
   `records.scout` に保存するか、座標を丸めたキーでキャッシュ用テーブルを作るのが良い。
3. UI（記録編集画面に「AIで下書き」ボタン → `POST /api/scout` → `scout` を各欄に流し込む）。

### キャッシュ（2026-07-28 追加）

`nearby_cache` テーブル（`0010_nearby_cache.sql` / **本番適用済み**）。
座標を小数第4位（≒11m）に丸めたキーで、周辺施設の取得結果を全ユーザーで共有する。

- 読み書きは `src/lib/nearby-cache.ts`（サービスロール＝サーバー専用）
- TTL 30日（施設の新設・閉鎖を拾い直すため）
- **空の結果は保存しない** — 一時的な取得失敗を30日固定してしまうので
- キャッシュが壊れても機能は止まらない（読めなければ外部APIに行くだけ）

実測: 初回 Overpass 7,614ms → 2回目 キャッシュ 128ms（約60倍）。
Overpassの429/504を踏む確率も、同じスポットでは実質ゼロになる。

### ⚠️ チップ語彙とAI出力の同期（重要）

`best_time` / `tripod` / `permit` は `RecordForm.tsx` で**チップ選択式**になっており語彙が固定。
AIが自由文を返すとチップが一つも選択状態にならず壊れるので、`scout-ai.ts` の
`responseSchema` の **enum** で出力を語彙そのものに縛っている。

```
SCOUT_TIMES  = ["朝焼け", "午前", "午後", "夕暮れ", "夜景"]
SCOUT_TRIPOD = ["可", "条件付き", "不可"]
SCOUT_PERMIT = ["不要", "要確認", "要申請"]
```

**この3つは `src/components/RecordForm.tsx` と `src/lib/scout-ai.ts` の両方に定義がある。
片方だけ変えると壊れる。** 両方に警告コメントを入れてあるが、変更時は必ず `scout-e2e.mjs` で確認すること。

### UI（記録フォーム）

「ロケハン情報」パネルの中に **「✨ AIで下書きする（空欄のみ）」** ボタン。

- 座標が未設定なら「先に地図でピンを置いてください」と案内（周辺検索に座標が必須のため）
- **既に入力済みの欄は上書きしない。** 空欄だけ埋めて「どの欄を埋めたか」を報告する
  （書いたメモを消されるのが一番困るため）
- 「根拠にした周辺データ（N件）」を `<details>` で開ける。AIが何を見て書いたかを人が検証できる
- Geminiが失敗しても周辺データは表示される（`/api/scout` が200で返す設計）

### 動作確認

```bash
node scripts/scout-e2e.mjs   # キャッシュ / enum一致 / 捏造チェック まで自動判定（失敗なら exit 1）
```

2026-07-28 実行: 全チェック通過（浅草寺 / `gemini-3.5-flash`）。

### 既知の環境問題

**このMacでは `tsc` が起動時にハングする**（node の `LoadEnvironment` で停止、CPU 0%）。
小さなnodeスクリプトは正常に動くので、`node_modules` の大量ファイル読み込みが詰まっている。
`Documents` 配下の同期が原因の可能性あり。型チェックは別環境で実行するか、
`node_modules` を同期対象外にすると直るかもしれない。

### 次にやると良いこと

1. **`GOOGLE_MAPS_API_KEY` を `.env.local` に追加**（`/api/geocode` の精度も同時に上がる）。
   `src/lib/nearby.ts` は キーがあれば自動で Google Places に切り替わる。コード変更は不要。
2. 生成結果への「AI下書き」バッジ表示（人が書いたメモと区別できるように）。
3. `SpotDetail` 側からも周辺情報だけを見られるようにする（`GET /api/scout` は無料）。
