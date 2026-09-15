-- S-pot 周辺施設キャッシュ（ロケハンAI用）
--
-- なぜ必要か:
--   /api/scout は駅・駐車場・トイレ・コンビニを外部の地図API（Google Places / Overpass）
--   から取得する。同じスポットを開くたびに叩くと、Google の無料枠も Overpass の
--   レート制限（429/504が普通に出る）も保たない。座標を丸めたキーで結果を共有キャッシュする。
--
-- 丸め幅:
--   小数第4位 ≒ 11m。撮影地としては同一地点とみなせる粒度。
--   （第3位=110mだと別の駐車場群になってしまうので細かめにしている）

create table if not exists public.nearby_cache (
  -- "35.7148,139.7967" 形式。lat/lng を小数第4位に丸めた文字列
  key text primary key,
  lat double precision not null,
  lng double precision not null,
  source text not null,              -- 'google' | 'osm'
  places jsonb not null,             -- Place[] をそのまま保持（項目追加に強い）
  created_at timestamptz not null default now()
);

create index if not exists nearby_cache_created_idx on public.nearby_cache (created_at);

alter table public.nearby_cache enable row level security;

-- 誰でも読める（施設の公開情報であり、個人データを含まない）。
-- 書き込みはサーバーのサービスロールのみ（RLSをバイパスするのでポリシー不要）。
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='nearby_cache' and policyname='nearby_cache: read all') then
    create policy "nearby_cache: read all" on public.nearby_cache
      for select using (true);
  end if;
end $$;
