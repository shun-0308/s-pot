-- S-pot 公開範囲(2026-06-12 適用済み)
-- visibility: private(自分だけ・既定) / members(有効会員に公開) / public(URLを知っていれば誰でも)
-- 設計方針:
--   * デフォルトは必ず private(公開は記録ごとのオプトイン)
--   * 退会者(active以外)の公開記録は自動で非表示になる(owner_active判定)
--   * GPS座標(lat/lng)は公開時にUI側で出さない(県までしか表示しない)

alter table public.records add column visibility text not null default 'private'
  check (visibility in ('private', 'members', 'public'));

create or replace function public.owner_active(owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = owner and membership_status = 'active');
$$;

-- 読み取りRLSを再定義(records / record_photos / storage.objects):
--   本人(active/grace) or 会員公開(閲覧者・持ち主ともactive) or リンク公開(持ち主active)
-- 全文は適用済みマイグレーション "record_visibility" を参照
