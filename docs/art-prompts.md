# 水彩アート地図 — 生成プロンプト一覧(47県)

パイプライン: ①実輪郭データ(国土数値情報N03 2021) → ②市区町村境界を焼き込んだ形状ガイドv3 → ③AIで水彩化。
形・境界はデータで担保し、AIは「塗り」だけを担当する。地形のみ・ランドマークなし。

## ガイドv3について

- `art-guides/NN_guide.png` は **市区町村境界(白線)入りの実輪郭ガイド**
- 再生成: `node scripts/generate-guides.mjs --root . [--only 13]`(要 `npm i sharp topojson-client`)
- 境界データ: `scripts/fetch-muni.sh` で取得(src/data/municipalities/)
- 投影・枠はアプリのピン投影(projGeo / mainRingBbox+20%pad)と完全一致。**縦横比を変えないこと**
- 出典表記: 「国土数値情報(行政区域データ N03 2021、国土交通省)を加工して作成」

## 手順

1. ChatGPT(または generate-maps.mjs)に `art-guides/NN_guide.png` を添付
2. 下の「共通プロンプト」+ 該当県の「地形行」を貼って生成
3. 良品を **ガイドと同じ縦横比のまま** `public/maps/NN.png` に保存 → 即反映
4. 検品ポイント: 輪郭・市区町村白線がガイドと一致 / 隣県(クリーム)と海(水色)の塗り分け / 人工物・文字の混入なし

## 共通プロンプト(全県共通・先頭に貼る)

```
The attached image is a precise map guide. Repaint it as a hand-painted
watercolor illustrated map, storybook style, top-down view, while keeping
every outline and boundary line exactly where it is.

Color meaning in the guide:
- khaki area = the target prefecture: paint with soft watercolor greens and terrain
- thin white lines inside the khaki area = municipality boundaries: keep them
  all, as delicate white boundary lines
- cream area = neighboring land: leave pale and quiet, plain paper tone
- light blue area = sea: gentle watercolor water with soft washes

Style: soft pastel colors, gentle paper texture, Japanese travel journal
aesthetic, warm and nostalgic, beautiful watercolor washes, picture book
illustration style, high detail, clean background.

Strict rules: do not move, simplify or stylize any outline or boundary line.
Terrain only — no landmarks, no buildings, no man-made structures.
No text, no labels, no roads, no GPS map appearance.
Output: same aspect ratio and same composition as the attached guide.
```

## 県別の地形行(共通プロンプトの後に1行追加)

| # | 県 | 地形行(英語) |
|---|---|---|
| 01 | 北海道 | Vast northern wilderness: volcanic mountain ranges, caldera lakes, wide plains and wetlands, long rugged coastlines. |
| 02 | 青森 | Two peninsulas embracing Mutsu Bay, deep beech forests, the Hakkoda mountains, Lake Towada in the south. |
| 03 | 岩手 | Sawtooth rias coastline on the Pacific, the broad Kitakami river valley, gentle inland mountains. |
| 04 | 宮城 | A coastal plain opening to a bay dotted with tiny pine-covered islands, mountains rising to the west. |
| 05 | 秋田 | A deep round caldera lake, the Oga peninsula jutting into the sea, rice plains and forested mountains. |
| 06 | 山形 | A great river winding through mountain basins, sacred forested peaks, snowy ranges on the east edge. |
| 07 | 福島 | Three bands: Pacific coastal plain, central basin, and western mountains with a large lake beneath a volcano. |
| 08 | 茨城 | A wide lagoon-like lake, flat farmland, one solitary twin-peaked mountain, a long straight Pacific beach. |
| 09 | 栃木 | Mountainous north with a high lake and waterfalls, rivers flowing south through a wide plain. |
| 10 | 群馬 | Volcanic mountains on three sides, deep river gorges and highland plateaus, plain opening to the southeast. |
| 11 | 埼玉 | Rugged wooded mountains in the west, a broad river crossing a wide flat plain to the east. |
| 12 | 千葉 | A green peninsula surrounded by sea, low rolling hills, one long sweeping sandy beach on the Pacific side. |
| 13 | 東京 | Forested mountains in the far west, gentle hills, rivers flowing east into a calm bay. |
| 14 | 神奈川 | A bay and an open ocean coast, a small peninsula, hot-spring mountains in the west, rivers from the north. |
| 15 | 新潟 | A long Sea of Japan coastline, wide rice-paddy plains, snowy mountains inland, a large island offshore. |
| 16 | 富山 | A deep bay embraced by land, steep alpine mountains in a great arc, rivers fanning down to the plain. |
| 17 | 石川 | A long slender peninsula reaching into the sea, a coastal plain, a sacred high mountain in the south. |
| 18 | 福井 | Rugged cliffs on the north coast, an intricate rias bay in the west, quiet mountains inland. |
| 19 | 山梨 | A great solitary volcano in the south with small lakes at its feet, a central basin ringed by high mountains. |
| 20 | 長野 | Towering alpine ranges running north to south, highland plateaus, a large lake in a central valley. |
| 21 | 岐阜 | Deep folded mountains and river gorges in the north, clear rivers spreading into plains in the south. |
| 22 | 静岡 | A great volcano at the northern edge, a deep blue bay, a rugged peninsula, rolling tea-green hills along the coast. |
| 23 | 愛知 | A wide flat plain with great rivers, two peninsulas curling around calm shallow bays. |
| 24 | 三重 | A long coastline: a wide bay in the north, an intricate rias peninsula in the middle, deep forested coast in the south. |
| 25 | 滋賀 | One vast lake filling the center, soft mountains surrounding it on all sides. |
| 26 | 京都 | A small peninsula and sandbar on the northern sea, deep quiet mountains in the middle, a river basin in the south. |
| 27 | 大阪 | A bay on the west, a fan-shaped river plain, low mountain ranges closing in from the east and south. |
| 28 | 兵庫 | Spanning two seas: calm island-dotted inland sea in the south with a large island, rugged northern coast, mountains between. |
| 29 | 奈良 | A gentle basin in the north, deep ancient forested mountains filling the south. |
| 30 | 和歌山 | A great forested peninsula: deep mountains, winding sacred rivers, a long curving Pacific coastline. |
| 31 | 鳥取 | Vast golden sand dunes along the coast, a tall solitary mountain in the west, lagoons and beaches. |
| 32 | 島根 | A long coastline with a large brackish lake, a plain by the sea, gentle mountains inland. |
| 33 | 岡山 | A calm inland sea scattered with small islands in the south, plains, low mountains rising to the north. |
| 34 | 広島 | An inland sea full of small green islands, river deltas at the coast, layered mountains behind. |
| 35 | 山口 | Sea on three sides with narrow straits, a white karst limestone plateau, gentle hills. |
| 36 | 徳島 | A swirling tidal strait in the northeast, a great river valley crossing the north, steep southern mountains. |
| 37 | 香川 | A small sunny plain dotted with conical hills, a calm inland sea with scattered islands to the north. |
| 38 | 愛媛 | A chain of islands stretching across the inland sea, a long coast, the highest peak of western Japan inland. |
| 39 | 高知 | A great open Pacific bay between two capes, a crystal-clear winding river, deep mountains at the back. |
| 40 | 福岡 | Two seas north and south, wide plains, low mountains, a coastline of beaches and small bays. |
| 41 | 佐賀 | Broad tidal flats on the southern sea, rice plains, a pine-grove coast on the north. |
| 42 | 長崎 | An intricate coastline of peninsulas, deep harbors and countless islands, a volcano in the southeast. |
| 43 | 熊本 | A gigantic volcanic caldera in the east, plains to a shallow sea in the west, island chains in the southwest. |
| 44 | 大分 | A wide bay, steaming highland volcano ranges inland, a rias coast in the south. |
| 45 | 宮崎 | A long subtropical Pacific coastline, deep gorges and mountains inland, rivers reaching the sea. |
| 46 | 鹿児島 | A volcano rising from a deep bay between two peninsulas, island chains trailing to the south. |
| 47 | 沖縄 | Coral-reef islands in an emerald sea, white sand beaches, low green hills. ※ガイドv3は本島周辺の実座標枠(宮古・八重山は枠外)。アプリ側のインセット表示・ピン投影は引き続き特殊扱い |

## 注意

- 現行 `public/maps/13.png`(雷門+タワー2本)はランドマーク入りの旧方針。地形のみ方針なら東京も本一覧で再生成して統一
- 生成画像にうっすら文字・建物が混入していたら不採用(再生成)
