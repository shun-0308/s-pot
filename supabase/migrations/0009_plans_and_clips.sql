-- S-pot お出かけプラン(旅のしおり) & クリップ(行きたい場所の保存) — 0009
-- 設計方針:
--   * クリップ = 「これから行きたい場所」のwishlist。♡(favorites=いいね/思い出)とは別物。
--     既存記録(records)由来でも、地図/検索で見つけたフリーな場所でも保存できる。
--   * プラン = 行きたいスポットを順番に並べた「旅のしおり」。項目は記録由来でもフリーでも可。
--   * visibility は records と同じ private/members/public。既定は private(公開はオプトイン)。
--     members/public の読み取りRLSも用意してあるので、みんなのプラン参考・公開はUIだけで足りる。

-- ── クリップ: 行きたい場所のwishlist ───────────────────────────
create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  record_id uuid references public.records on delete set null, -- 記録由来ならその参照(任意)
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists clips_user_idx on public.clips (user_id, created_at desc);
-- 同じ記録を二重クリップしない(フリー場所は record_id is null なので対象外)
create unique index if not exists clips_user_record_uidx
  on public.clips (user_id, record_id) where record_id is not null;

alter table public.clips enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='clips' and policyname='clips: own rows only') then
    create policy "clips: own rows only" on public.clips
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ── プラン(旅のしおり) ────────────────────────────────────────
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null default auth.uid(),
  title text not null,
  description text,
  plan_date date,                 -- 予定日(任意)
  visibility text not null default 'private' check (visibility in ('private','members','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plans_user_idx on public.plans (user_id, updated_at desc);
create index if not exists plans_visibility_idx on public.plans (visibility) where visibility <> 'private';

alter table public.plans enable row level security;
-- 本人は全操作可
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plans' and policyname='plans: owner all') then
    create policy "plans: owner all" on public.plans
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
-- 会員公開: 閲覧者・持ち主ともactiveなら読める(みんなのプラン参考・フェーズ2)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plans' and policyname='plans: members read') then
    create policy "plans: members read" on public.plans
      for select using (
        visibility = 'members'
        and public.owner_active(user_id)
        and exists (select 1 from public.profiles me where me.id = auth.uid() and me.membership_status = 'active')
      );
  end if;
end $$;
-- リンク公開: 持ち主activeなら誰でも読める
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plans' and policyname='plans: public read') then
    create policy "plans: public read" on public.plans
      for select using (visibility = 'public' and public.owner_active(user_id));
  end if;
end $$;

-- ── プラン項目(行き先・順序つき) ──────────────────────────────
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans on delete cascade not null,
  record_id uuid references public.records on delete set null, -- 記録由来なら参照(任意)
  sort int not null default 0,
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  note text,                       -- ひとことメモ
  planned_time text,               -- "10:00" 等(任意・自由入力)
  created_at timestamptz not null default now()
);
create index if not exists plan_items_plan_idx on public.plan_items (plan_id, sort);

alter table public.plan_items enable row level security;
-- 親プランが読めるなら項目も読める(plansのRLSが効くので会員公開プランの項目も見える)
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plan_items' and policyname='plan_items: read if plan readable') then
    create policy "plan_items: read if plan readable" on public.plan_items
      for select using (exists (select 1 from public.plans p where p.id = plan_id));
  end if;
end $$;
-- 書けるのは親プランの持ち主のみ
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='plan_items' and policyname='plan_items: owner write') then
    create policy "plan_items: owner write" on public.plan_items
      for all
      using (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()))
      with check (exists (select 1 from public.plans p where p.id = plan_id and p.user_id = auth.uid()));
  end if;
end $$;
