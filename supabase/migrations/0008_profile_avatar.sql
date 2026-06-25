-- S-pot プロフィール顔写真(アバター)対応(2026-06-25 適用済み)
-- profiles.avatar_path に保存パスを持ち、公開バケット avatars に画像を置く。
-- アバターは他ユーザーにも表示するため public バケット(URLを知れば誰でも閲覧可)。
-- ファイル名はUUIDで推測困難。書き込みは本人の {uid}/... フォルダのみ。

alter table public.profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars public read') then
    create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars own insert') then
    create policy "avatars own insert" on storage.objects for insert
      with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars own update') then
    create policy "avatars own update" on storage.objects for update
      using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='avatars own delete') then
    create policy "avatars own delete" on storage.objects for delete
      using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;
