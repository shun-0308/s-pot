-- フォロー機能(2026-06-23)

create table public.follows (
  follower_id uuid references auth.users not null,
  following_id uuid references auth.users not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;

-- ログイン済みなら誰でも閲覧可(フォロー状態チェックのため)
create policy "follows select" on public.follows
  for select using (auth.uid() is not null);

-- 自分のフォローのみ追加可
create policy "follows insert" on public.follows
  for insert with check (auth.uid() = follower_id);

-- 自分のフォローのみ削除可
create policy "follows delete" on public.follows
  for delete using (auth.uid() = follower_id);

-- フォロワー数を高速に取得するためのインデックス
create index follows_following_idx on public.follows (following_id);
create index follows_follower_idx on public.follows (follower_id);
