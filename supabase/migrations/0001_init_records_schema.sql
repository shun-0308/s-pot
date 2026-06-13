-- S-pot 初期スキーマ(2026-06-12 にSupabaseプロジェクト ccjhyokcqzrvdjctroyf へ適用済み)

-- 記録
create table public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  pref_code int not null check (pref_code between 1 and 47), -- JIS都道府県コード
  name text not null,              -- 場所の名前
  taken_at date,                   -- 撮影日(EXIF由来 or 手入力)
  body text,                       -- 記録文
  lat double precision,            -- 写真のGPS(任意)
  lng double precision,
  created_at timestamptz default now()
);

-- 写真(1記録に複数枚)
create table public.record_photos (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references public.records on delete cascade not null,
  storage_path text not null,      -- Supabase Storage
  sort int default 0
);

create index records_user_pref_idx on public.records (user_id, pref_code);
create index record_photos_record_idx on public.record_photos (record_id);

-- RLS: user_id = auth.uid() のみ読み書き可
alter table public.records enable row level security;
alter table public.record_photos enable row level security;

create policy "own records select" on public.records for select using (auth.uid() = user_id);
create policy "own records insert" on public.records for insert with check (auth.uid() = user_id);
create policy "own records update" on public.records for update using (auth.uid() = user_id);
create policy "own records delete" on public.records for delete using (auth.uid() = user_id);

create policy "own photos select" on public.record_photos for select
  using (exists (select 1 from public.records r where r.id = record_id and r.user_id = auth.uid()));
create policy "own photos insert" on public.record_photos for insert
  with check (exists (select 1 from public.records r where r.id = record_id and r.user_id = auth.uid()));
create policy "own photos update" on public.record_photos for update
  using (exists (select 1 from public.records r where r.id = record_id and r.user_id = auth.uid()));
create policy "own photos delete" on public.record_photos for delete
  using (exists (select 1 from public.records r where r.id = record_id and r.user_id = auth.uid()));

-- Storage: photos バケット(非公開)。パスは {user_id}/... 規約
insert into storage.buckets (id, name, public) values ('photos', 'photos', false);

create policy "own storage select" on storage.objects for select
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own storage insert" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own storage update" on storage.objects for update
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "own storage delete" on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
