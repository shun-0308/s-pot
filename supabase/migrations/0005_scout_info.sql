-- S-pot ロケハン情報(2026-06-12 適用済み)
-- カメラマン向けの撮影地メモ。項目追加に強いようjsonbで保持
-- 想定キー: best_time(ベスト時間帯) / tripod(三脚) / permit(撮影許可)
--           light(光のメモ) / access(駐車場・アクセス) / notes(機材・混雑など)
alter table public.records add column scout jsonb;
