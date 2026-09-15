// 地図タイルの共通設定。
// なぜ自作モジュールにしたか:
//   CARTO(basemaps.cartocdn.com)は APIキー必須に変わり、キー無しだと
//   「API KEY REQUIRED」の透かし入りタイルを返すようになった。
//   そこで キー不要 かつ 商用可 の提供元へ統一する。
//     ・日本国内 … 国土地理院(GSI)淡色地図。番地レベルまで日本語で読める。
//     ・海外     … OpenStreetMap 標準タイル。
//   どちらも Leaflet に「同時に」載せ、日本の範囲では GSI が OSM を覆う形にする
//   （GSI は日本国外が空タイルなので、下に OSM を敷けば継ぎ目なく世界が見える）。

import type * as LType from "leaflet";

export const MAX_ZOOM = 19; // 番地・建物レベルまで寄れる

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const GSI_PALE = "https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png";
const GSI_STD = "https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png";
const GSI_PHOTO = "https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg";
const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>';

// 日本のおおよその範囲(GSIタイルを重ねる範囲)
const JP_BOUNDS: [[number, number], [number, number]] = [
  [20.0, 122.0],
  [46.5, 154.0],
];

export type BaseStyle = "pale" | "std" | "photo";

// 世界(OSM)の上に日本(GSI)を重ねた基図を地図へ追加する。
export function addBaseLayers(L: typeof LType, map: LType.Map, style: BaseStyle = "pale") {
  const world = L.tileLayer(OSM_URL, {
    maxZoom: MAX_ZOOM,
    maxNativeZoom: 19,
    attribution: OSM_ATTR,
    crossOrigin: true,
  }).addTo(map);

  const jpUrl = style === "photo" ? GSI_PHOTO : style === "std" ? GSI_STD : GSI_PALE;
  const japan = L.tileLayer(jpUrl, {
    maxZoom: MAX_ZOOM,
    maxNativeZoom: 18,
    bounds: L.latLngBounds(JP_BOUNDS),
    attribution: GSI_ATTR,
    crossOrigin: true,
  }).addTo(map);

  return { world, japan };
}

// 座標が日本の範囲内か(検索の絞り込みや表示の切り替えに使う)
export function isInJapan(lat: number, lng: number) {
  return lat >= JP_BOUNDS[0][0] && lat <= JP_BOUNDS[1][0] && lng >= JP_BOUNDS[0][1] && lng <= JP_BOUNDS[1][1];
}
