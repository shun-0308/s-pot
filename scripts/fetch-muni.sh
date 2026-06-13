#!/bin/bash
# 市区町村境界TopoJSON(国土数値情報N03 2021 / smartnews-smri/japan-topography s0010簡略化)を47県分取得
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)/src/data/municipalities"
mkdir -p "$DIR"
BASE="https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0010"
ok=0; fail=0
for i in $(seq -w 1 47); do
  f="$DIR/$i.json"
  if [ -s "$f" ]; then ok=$((ok+1)); continue; fi
  if curl -fsSL "$BASE/N03-21_${i}_210101.json" -o "$f"; then ok=$((ok+1)); else fail=$((fail+1)); rm -f "$f"; fi
done
echo "ok=$ok fail=$fail"
ls "$DIR" | wc -l
