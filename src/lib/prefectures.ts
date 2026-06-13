import rawData from "@/data/japan-pref-paths.json";

export type Prefecture = {
  id: number; // JIS都道府県コード 1〜47
  name: string;
  d: string; // SVGパス(実地形・沖縄は左上インセット)
  cx: number; // 県の中心座標
  cy: number;
};

export const PREFECTURES = rawData as Prefecture[];

export const prefByCode = (code: number): Prefecture | undefined =>
  PREFECTURES.find((p) => p.id === code);

// 地域カラー(デザイントークン準拠)
export const regionColor = (id: number): string => {
  if (id <= 7) return "#9DBE8D"; // 北海道東北: 苔
  if (id <= 14) return "#8FB7CC"; // 関東: 瀬戸内ブルー
  if (id <= 23) return "#A8C8B8"; // 中部: 青磁
  if (id <= 30) return "#C9A8D4"; // 近畿: 藤
  if (id <= 39) return "#E0A878"; // 中四国: 柿
  return "#D9C97E"; // 九州沖縄: 蜜柑
};

// 英字キャプション用の県名ローマ字
export const PREF_EN: Record<number, string> = {
  1: "HOKKAIDO", 2: "AOMORI", 3: "IWATE", 4: "MIYAGI", 5: "AKITA", 6: "YAMAGATA",
  7: "FUKUSHIMA", 8: "IBARAKI", 9: "TOCHIGI", 10: "GUNMA", 11: "SAITAMA",
  12: "CHIBA", 13: "TOKYO", 14: "KANAGAWA", 15: "NIIGATA", 16: "TOYAMA",
  17: "ISHIKAWA", 18: "FUKUI", 19: "YAMANASHI", 20: "NAGANO", 21: "GIFU",
  22: "SHIZUOKA", 23: "AICHI", 24: "MIE", 25: "SHIGA", 26: "KYOTO", 27: "OSAKA",
  28: "HYOGO", 29: "NARA", 30: "WAKAYAMA", 31: "TOTTORI", 32: "SHIMANE",
  33: "OKAYAMA", 34: "HIROSHIMA", 35: "YAMAGUCHI", 36: "TOKUSHIMA", 37: "KAGAWA",
  38: "EHIME", 39: "KOCHI", 40: "FUKUOKA", 41: "SAGA", 42: "NAGASAKI",
  43: "KUMAMOTO", 44: "OITA", 45: "MIYAZAKI", 46: "KAGOSHIMA", 47: "OKINAWA",
};

// キャプション: "EHIME — 2026.06.16"
export const captionOf = (prefCode: number | null, takenAt: string | null): string =>
  `${(prefCode != null && PREF_EN[prefCode]) || ""}${takenAt ? ` — ${takenAt.replaceAll("-", ".")}` : ""}`;

// パスからbboxを計算(県単体表示用)
export const bboxOf = (d: string) => {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (let i = 0; i < nums.length; i += 2) {
    minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
    minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
};

// 本土(最大の島)だけのbbox。東京の小笠原など遠隔離島で表示が間延びするのを防ぐ
export const mainRingBboxOf = (d: string) => {
  let best: { minX: number; minY: number; w: number; h: number } | null = null;
  let bestArea = -1;
  for (const seg of d.split("Z")) {
    if (!seg.trim()) continue;
    const nums = (seg.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length < 6) continue;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < nums.length; i += 2) {
      minX = Math.min(minX, nums[i]); maxX = Math.max(maxX, nums[i]);
      minY = Math.min(minY, nums[i + 1]); maxY = Math.max(maxY, nums[i + 1]);
    }
    const area = (maxX - minX) * (maxY - minY);
    if (area > bestArea) {
      bestArea = area;
      best = { minX, minY, w: maxX - minX, h: maxY - minY };
    }
  }
  return best ?? bboxOf(d);
};
