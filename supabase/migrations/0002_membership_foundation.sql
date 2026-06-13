-- S-pot 会員ステータス基盤(2026-06-12 適用済み)
-- 方針(決定事項): 退会時はアクセス即停止 → 猶予期間中は閲覧・エクスポートのみ可 → 期限後に削除
-- ステータス: active(全操作可) / grace(閲覧のみ・grace_untilまで) / expired(全停止)
-- 再入会時は membership_status を active に戻すだけで復活

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  membership_status text not null default 'active'
    check (membership_status in ('active', 'grace', 'expired')),
  grace_until date,           -- 猶予期限(この日以降に削除対象)
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);

-- サインアップ時に自動でプロフィール作成
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 会員ステータス判定ヘルパー
create or replace function public.member_status()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select membership_status from public.profiles where id = auth.uid()), 'expired');
$$;

-- RLS再定義: 読み取りは active/grace、書き込みは active のみ
-- (records / record_photos / storage.objects の全ポリシーに member_status() 条件を追加)
-- 全文は適用済みマイグレーション "membership_foundation" を参照(Supabaseダッシュボード → Database → Migrations)

-- 退会オペレーション(S-Lab退会時に実行する想定):
--   update public.profiles set membership_status = 'grace',
--     grace_until = current_date + interval '90 days' where id = '<user_id>';
-- 期限後の削除バッチ(Phase 3で自動化検討):
--   delete対象: profiles where membership_status = 'grace' and grace_until < current_date
