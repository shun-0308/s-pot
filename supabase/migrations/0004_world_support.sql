-- S-pot 世界対応(2026-06-12 適用済み)
-- 記録は国単位に拡張。日本('392')のみ県単位(pref_code)を併用
-- country_code: ISO 3166-1 numeric文字列(world-atlas TopoJSONのid準拠)
alter table public.records alter column pref_code drop not null;
alter table public.records add column country_code text not null default '392';
alter table public.records add constraint records_jp_needs_pref
  check (country_code <> '392' or pref_code is not null);
create index records_user_country_idx on public.records (user_id, country_code);
