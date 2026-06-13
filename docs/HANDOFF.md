# S-pot 引き継ぎ書(新セッション用)

最終更新: 2026-06-12 / 前セッションからの引き継ぎ。これを読んだら「続きから」作業できる。

## プロジェクト概要

- **S-pot — 旅の図鑑**: 「人生で訪れた場所を集め、自分だけの地図を完成させていくアプリ」。Pokemon図鑑/冒険マップ的体験。感情設計は「記録しなきゃ」ではなく「**地図を完成させたい**」
- 世界観「**旅人きどり**」: 古い旅ノート/和紙/水彩/フィルム写真/静かな旅。SNS感は不要
- 設計書: `docs/design-v2-tabibito.md`(UI構成/デザインシステム/ゲーム要素提案。必読)
- ユーザー: 松本瞬さん(写真家、S-Lab主宰)。将来S-Lab会員に公開予定
- **瞬さんの好み**: ビジュアル品質に厳しい。生成物の欠陥(例: 東京タワーが2本)を見逃すとNG。返答は簡潔に、質問には真っ先に答える

## 技術・環境

- Next.js 15 + TS + Tailwind v4 / three.js / d3-geo / Supabase。場所: `~/Documents/s-pot`
- **devサーバ: port 3100** で起動中のはず。再起動: Terminalで `cd ~/Documents/s-pot && npm run dev -- --port 3100`
- Mac の node: nvm `/Users/shunmatsumoto/.nvm/versions/node/v24.15.0/bin`(PATH に要追加)。Homebrew node も有り
- Supabase: project `ccjhyokcqzrvdjctroyf`(東京)。接続情報は `.env.local` 設定済み。マイグレーション0001〜0005適用済み(records/photos/RLS/会員ステータス/公開範囲/世界対応country_code/scout jsonb)。詳細は `supabase/migrations/`
- 退会設計: profiles.membership_status(active/grace/expired)。公開範囲: records.visibility(private/members/public)
- OpenAI APIキー: `~/.spot_openai_key` に保存済み(画像生成用。作業後に失効推奨)

## サンドボックス内での検証方法(Claude用)

- マウントの `~/Documents/s-pot` は IO が遅くビルド不可。**`~/sp` にコピーしてビルド**: `cp -rf src/. ~/sp/src/ && cd ~/sp && npx tsc --noEmit && npx next build`(45秒制限内で完走する)
- マウント先のファイル**削除は不可**(rm権限なし)。削除はMac側(osascript)で
- osascript は長いコマンドだと失敗しがち → 短く分ける or `scripts/run-gen.sh` 方式
- Macの操作: `mcp__Control_your_Mac__osascript`。System Eventsのキー送信は不許可

## 画面構成(現状)

1. **地球(ホーム)** `GlobeView.tsx`: three.js衛星写真地球(昼夜シェーダー・都市夜景・大気)、HUD太陽(右上)、月、星空。国ホバーで照準線、クリックでズーム→日本 or 国ページ。メニューからの遷移も地球ズーム経由(flyTo)
2. **日本地図** `JapanMap.tsx`: ターコイズ衛星背景+グリッド+照準カーソル+土色バッジ。統計列・RECENT RECORDS付き(page.tsx内)
3. **県ページ** `PrefPage.tsx`(旅人きどりv2・直近の主作業): デスクトップ2カラム(左=地図シート: 中央タイトル+手書きTokyo+PrefArt+統計+地平線 / 右=sticky: CTA・RecordForm・ポラロイドPolaroidCard)。スマホは縦積み
4. **PrefArt.tsx**: 県の一枚絵。`public/maps/{県コード}.png` があれば**無加工(meet)表示**、なければカーキのシルエット+手書き地名ラベル(Klee One)+最新記録は土色マーカー
5. 記録詳細 `SpotDetail.tsx`(暗幕・ロケハン表示・Googleマップリンク) / ログ一覧 / みんなの図鑑 / SideMenu(地球経由ナビ) / StampCelebration(土色の押印演出)

## デザイントークン(v2)

- 和紙 #F5F0E6(+`/textures/washi.jpg` 継ぎ目なしテクスチャ) / 墨 #2E2A25 / 苔 #8E9A7A / 深苔 #6D7B64 / 土 #9A7B5F(印・アクセント。朱は引退)
- フォント: Shippori Mincho B1 / Zen Kaku Gothic New / Klee One(手書き和文) / Caveat(手書き欧文)
- 統計: 訪れた場所(グリッド踏破 visited/total)・踏破率%・写真枚数。`prefGridStats()` in geo.ts

## 水彩アート地図パイプライン(直近の主題)

- `art-guides/NN_guide.png` = 形状ガイドv2(カーキ=対象県/クリーム=隣県/水色=海)。README.md に手順
- `scripts/generate-maps.mjs` + `scripts/run-gen.sh` = API一括生成(OpenAI gpt-image-1)
- **経緯と決定**: API一発生成は品質が不安定(東京タワー2本事件)。**方針=案B: 瞬さんがChatGPTで直接生成(品質を本人の目で担保)、Claudeはプロンプト準備・ファイル配置・検品を担当**。`public/maps/{id}.png` に置けば即反映
- 現在 `public/maps/13.png` = タワー2本の失敗作。**要差し替え**

## 次にやること(優先順)

1. **画面構成の仕上げ**(瞬さん指示「画面の構成をまず整えよう」): 県ページ2カラムの実機確認・微調整。washi継ぎ目は修正済み(要confirm)
2. 東京のアート差し替え(ChatGPT直生成フロー確立。47県分のプロンプト一覧を用意すると親切)
3. 日本地図の水彩化 / 白→記録で色づくシルエット演出(design-v2参照)
4. Vercelデプロイ(スマホ実機確認。PWA化はその後)
5. ゲーミフィケーション実装(旅章・景色図鑑・旅印帳 — design-v2 §7)

## 既知の注意

- 沖縄(47)は地図パスがインセット座標のため、GPSピン投影・ガイド生成で特殊扱い(スキップ or 専用bounds)
- 土色 #9A7B5F は一部コンポーネントに直書きあり(StampCelebration等)
- 旧アクセント朱 #B23A24 は GlobeView(地球の訪問国塗り)にだけ意図的に残存
- ビルドは常に tsc → next build の順で検証してから報告する
