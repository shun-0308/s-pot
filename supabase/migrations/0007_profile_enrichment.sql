-- S-pot プロフィール欄の充実(2026-06-25 適用済み)
-- 既存の display_name に加えて、自己紹介・拠点・SNS・使用機材を保持する。
-- すべて任意項目(nullable)。RLSは既存のまま:
--   * 本人のみ UPDATE 可("own profile update")
--   * 有効会員は全プロフィールを SELECT 可("members read profiles")

alter table public.profiles add column if not exists bio text;        -- 自己紹介
alter table public.profiles add column if not exists area text;       -- 拠点・活動エリア
alter table public.profiles add column if not exists instagram text;  -- Instagram(ID or URL)
alter table public.profiles add column if not exists website text;    -- サイト/その他リンク
alter table public.profiles add column if not exists gear text;       -- 使用機材(カメラ等)
