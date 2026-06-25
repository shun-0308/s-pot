-- S-pot お気に入り機能(Supabaseダッシュボードで先行作成済みのものを追記・冪等化)
-- 記録(自分・他人の会員公開どちらも)に♡を付けられる。1ユーザー×1記録で一意。

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  record_id uuid references public.records on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, record_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id);
create index if not exists favorites_record_idx on public.favorites (record_id);

alter table public.favorites enable row level security;

-- 自分の行のみ全操作可
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'favorites'
      and policyname = 'favorites: own rows only'
  ) then
    create policy "favorites: own rows only" on public.favorites
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
