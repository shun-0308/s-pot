# 💳 S-pot Stripe決済 設定マニュアル

> 2026-06-22 に決済が動くまで直した記録＋手順書。次に困ったら **まず「5. エラー別 早見表」** を見る。

---

## 0. これだけは絶対（大原則）

Stripeの設定値は **「ぜんぶ同じ"本番"環境のもの」で揃える**。
1つでも **テスト／サンドボックス／別プロジェクト（S-Lab）** のものが混ざると決済が壊れる。

今回詰まった原因も、これ（鍵だけテスト側のものが混ざっていた）でした。

---

## 1. 仕組み（30秒で理解）

- **LP**（`s-pot.vercel.app/lp.html`）も **アプリ本体** も、同じ `/api/stripe/checkout` を使う。
- そのAPIは **Vercel の「環境変数」3つ** を読んで動く：

| 環境変数 | 役割 |
|---|---|
| `STRIPE_SECRET_KEY` | Stripeを操作する秘密の鍵 |
| `STRIPE_PRICE_ID` | ¥480/月の価格 |
| `STRIPE_WEBHOOK_SECRET` | 決済後にプレミアムを付与する通知の鍵 |

- つまり設定はぜんぶ **Vercelの環境変数**で決まる。**直したら必ず再デプロイ**。

---

## 2. 「本番モード」にいるか確認（超重要）

- Stripe左上のアカウント名メニューを開く。
  - **「サンドボックスに切り替える」と出ていれば、今は本番にいる**（＝正しい）。
  - オレンジの「テスト」表示が出ていたらテスト側 → 切り替える。
- アカウント名 **「フォト＆ビデオグラファー」＝本番**。
  - 「〜サンドボックス」「テスト環境」は **使わない**。
- **「S-Lab」は完全に別アプリ**。Stripeもキーも別物。**絶対に混ぜない**。

---

## 3. 3つの値の取り方

### ① STRIPE_SECRET_KEY（秘密の鍵）
- 場所：**開発者 → APIキー → 「標準キー」の【シークレットキー】**
- `sk_live_` で始まる。末尾 **`rN9z`** が正解。
- ❌ `rk_live_`（制限付き）と `pk_live_`（公開可能キー）は **使わない**。
- ⚠️ この鍵は **一度しか全部表示されない**。ローカルの `s-pot/.env.local` に保存済み。
  - ターミナルでコピー（画面に出さず安全）：
    ```
    grep '^STRIPE_SECRET_KEY=' "/Users/shunmatsumoto/Documents/s-pot/.env.local" | cut -d= -f2- | tr -d '\n' | pbcopy
    ```
    実行後そのまま `Cmd+V` で貼れる。

### ② STRIPE_PRICE_ID（価格ID）
- 場所：**商品カタログ → 「S-pot 月額プラン」→ 料金の【¥480 毎月】の行 → ⋯ → IDをコピー**
- `price_` で始まる。**現在の正解：`price_1TknH6FtjUIo5PgaLKhQQKis`**
- ❌ `prod_`（商品ID）は別物。❌「毎月」が付いていない¥480（一回払い）も不可。

### ③ STRIPE_WEBHOOK_SECRET（通知の鍵）
- 場所：**開発者 → Webhook → 本番エンドポイント → 署名シークレット**
- エンドポイントURL：`https://s-pot.vercel.app/api/stripe/webhook`
- `whsec_` で始まる。
- 受信イベント（5つ）：
  `customer.subscription.created` / `updated` / `deleted`、
  `invoice.payment_succeeded` / `invoice.payment_failed`

---

## 4. Vercelに設定する手順

1. **vercel.com** → プロジェクト **`s-pot`**（`s-lab`ではない！）
2. **Settings → Environment Variables**
3. 対象の変数 → 右の **⋯ → Edit** → 値を全部消して貼り付け → **Save**
4. 出てくる青いトースト or 一覧の **「Redeploy」** を押す
   （または Deployments → 最新の⋯ → Redeploy → Production を選んで Redeploy）
5. 最新デプロイが **Ready** になったら反映完了

---

## 5. エラー別 早見表（困ったらここ）

| 画面のエラー | 原因 | 直し方 |
|---|---|---|
| **No such price: 'price_...'** | 価格IDがテスト/サンドボックスのもの。または商品ID(`prod_`)を入れている | 本番の「¥480 毎月」の `price_` を入れ直す（→3-②） |
| **No such customer: 'cus_...'** | 昔テストで作った顧客IDがDBに残っている | Supabaseで古い `cus_` を消す（→下のSQL） |
| **認証エラー / Invalid API Key** | 鍵が間違い、または別環境/別プロジェクトの鍵 | 本番の `sk_live` に差し替え（→3-①） |
| **決済はできたがプレミアムにならない** | webhookがテスト側/未設定 | 本番webhookの `whsec_` に差し替え（→3-③） |

### 「No such customer」用 SQL（テスト→本番に切り替えた直後は必ず必要）
- Supabase → プロジェクト **`s-pot`**（project id `ccjhyokcqzrvdjctroyf`）→ **SQL Editor**
  ```sql
  -- 古い顧客IDだけ消す（会員ステータスには絶対に触らない）
  UPDATE profiles
  SET stripe_customer_id = NULL,
      stripe_subscription_id = NULL
  WHERE stripe_customer_id IS NOT NULL;
  ```
- 意味：古い顧客IDを消す → 次の申し込みで本番の顧客が作り直される。
- ⚠️ **`membership_status` は絶対に変えないこと**。これは投稿の表示権限を兼ねていて、`expired` にすると投稿が画面上で見えなくなる（＝データは消えないが非表示。`active`に戻せば復活）。

---

## 6. テスト方法

1. `s-pot.vercel.app/lp.html` を **シークレットウィンドウ**で開く（キャッシュ回避）
2. 申し込み → メール入力 → マジックリンク → 戻る
3. `checkout.stripe.com` に飛んでカード入力画面が出ればOK
   - **URLが `cs_live_...` で始まっていれば本番**（`cs_test_` ならまだテスト）

---

## 7. 大事な場所・値まとめ

- **Vercel (s-pot)**：vercel.com/shun-matsumotos-projects/s-pot
- **Supabase (s-pot)**：project id `ccjhyokcqzrvdjctroyf`（※`imjymj...`はS-Labなので注意）
- **Stripe 本番アカウント**：フォト＆ビデオグラファー（`acct_1Tb7zz...`）
- **設定ファイル**：`s-pot/.env.local`（バックアップ `.env.local.bak` あり）
- **現在の正しい値**：
  - `STRIPE_PRICE_ID` = `price_1TknH6FtjUIo5PgaLKhQQKis`
  - `STRIPE_SECRET_KEY` = `sk_live...`（末尾 `rN9z`）
  - `STRIPE_WEBHOOK_SECRET` = `whsec...`（本番Webゔックのもの）

---

## 8. クーポン / 特別メンバーを無料にする

### 用語
- **クーポン** ＝ 割引の中身（例：100%オフ・永久、初月無料）
- **プロモーションコード** ＝ お客さんが打ち込む文字列（クーポンに紐づく。例 `MEMBER-FREE`）

### コード側の設定（対応済み）
`src/app/api/stripe/checkout/route.ts` に追加済み：
- `allow_promotion_codes: true` … 決済画面に「プロモーションコードを追加」欄を出す
- `payment_method_collection: "if_required"` … 合計¥0のときカード入力を省略（無料メンバー用）

⚠️ **反映には `vercel --prod` での再デプロイが必要**（Git未連携のためVercelの「Redeploy」ボタンでは古いコードのまま）。
```
cd "/Users/shunmatsumoto/Documents/s-pot" && vercel --prod
```

### 方法A：コードで無料にする（おすすめ・メンバー本人が手続き）
1. Stripe**本番**で：商品カタログ → クーポン → **クーポンを作成**
   - 割引：**100% オフ**
   - 期間：**ずっと（forever）**（永久無料）／初月だけなら「1回」
2. そのクーポンに **プロモーションコードを追加**（例 `MEMBER-FREE`）。これが配布する文字列。
3. メンバーに渡す。申し込み → 「プロモーションコードを追加」→ 入力 → **¥0/月で登録**。
   - カード不要で完了（`payment_method_collection: if_required` のおかげ）。
   - 登録後 webhook が `membership_status` を active にする＝プレミアム開放。

### 方法B：運営側で直接無料にする（コードも手続きも不要）
特定の人を即プレミアムにしたいとき。Supabase → s-pot(`ccjhyokcqzrvdjctroyf`) → SQL Editor：
```sql
-- メールアドレスからユーザーを探して active にする
UPDATE profiles
SET membership_status = 'active'
WHERE id = (SELECT id FROM auth.users WHERE email = 'member@example.com');
```
- Stripeを通さないので請求も発生しない。解除は `'expired'` に戻す。
- 注意：Stripe上にはサブスクが残らない。台帳で管理したいなら方法Aが綺麗。

### 注意
- クーポン／プロモコードは必ず **本番モード**で作る（テスト/サンドボックスのは本番で使えない）。

---

## 9. 次回チェックリスト（コピペ用）

- [ ] Stripeが本番モードか（オレンジ表示なし／メニューが「サンドボックスに切り替える」）
- [ ] `STRIPE_SECRET_KEY` = 本番 `sk_live`（末尾rN9z）
- [ ] `STRIPE_PRICE_ID` = 本番「¥480 毎月」の `price_`
- [ ] `STRIPE_WEBHOOK_SECRET` = 本番Webhookの `whsec_`
- [ ] 3つ揃えたら Vercel で Redeploy
- [ ] 顧客エラーが出たら Supabase で古い `cus_` をクリア（上のSQL）
- [ ] シークレットウィンドウで `lp.html` からテスト → `cs_live_` の画面が出ればOK
