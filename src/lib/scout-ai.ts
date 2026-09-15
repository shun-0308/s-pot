// ロケハン情報(records.scout)の下書きをAIで作る。
//
// 事実（駅・駐車場・トイレ・コンビニ）は lib/nearby.ts が地図APIから取得済みのものだけを渡す。
// Gemini には「渡した事実の範囲で書く」ことだけをさせる = 施設名の捏造を構造的に防ぐ。
// best_time / light / tripod のような一般的な撮影知識だけはモデルの知識に委ねる。
//
// ⚠️ best_time / tripod / permit は RecordForm.tsx でチップ選択式になっており、
//    語彙が固定されている。自由文を返すとチップが一つも選択状態にならないので、
//    responseSchema の enum でモデルの出力を語彙そのものに縛っている。
//    （SCOUT_TIMES / SCOUT_TRIPOD / SCOUT_PERMIT と必ず一致させること）

import { generate } from "./gemini";
import type { Place } from "./nearby";

/** RecordForm.tsx の SCOUT_TIMES と一致させる */
export const SCOUT_TIMES = ["朝焼け", "午前", "午後", "夕暮れ", "夜景"] as const;
/** RecordForm.tsx の SCOUT_TRIPOD と一致させる */
export const SCOUT_TRIPOD = ["可", "条件付き", "不可"] as const;
/** RecordForm.tsx の SCOUT_PERMIT と一致させる */
export const SCOUT_PERMIT = ["不要", "要確認", "要申請"] as const;

/** supabase.ts の ScoutInfo に対応（best_time/tripod/permit は固定語彙） */
export type ScoutDraft = {
  best_time: (typeof SCOUT_TIMES)[number];
  tripod: (typeof SCOUT_TRIPOD)[number];
  permit: (typeof SCOUT_PERMIT)[number];
  light: string;
  access: string;
  notes: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    best_time: { type: "string", enum: [...SCOUT_TIMES] },
    tripod: { type: "string", enum: [...SCOUT_TRIPOD] },
    permit: { type: "string", enum: [...SCOUT_PERMIT] },
    light: { type: "string" },
    access: { type: "string" },
    notes: { type: "string" },
  },
  required: ["best_time", "tripod", "permit", "light", "access", "notes"],
};

const SYSTEM = `あなたは日本の風景・旅写真に詳しいロケハン担当です。
出力ルール:
- 施設名・駅名・駐車場名は、与えられた「周辺の実データ」に載っているものだけを使う。データに無い固有名詞は絶対に書かない。
- 料金・営業時間はデータに無ければ書かない。「要確認」と書く。
- light / access / notes は1〜2文、80文字以内。撮影者がその場で使える具体性を優先する。
- 断定できないことは「〜のことが多い」「現地で確認」と正直に書く。
- 迷ったら安全側に倒す（三脚は「条件付き」、撮影許可は「要確認」）。
- 敬体（です・ます）で書く。`;

const LABEL: Record<Place["kind"], string> = {
  station: "駅",
  parking: "駐車場",
  toilet: "トイレ",
  convenience: "コンビニ",
};

function formatPlaces(places: Place[]): string {
  if (places.length === 0) return "（周辺施設のデータは取得できませんでした）";
  return places
    .map((p) => {
      const bits = [
        p.name,
        `${p.distance_m}m`,
        p.fee === true ? "有料" : p.fee === false ? "無料" : null,
        p.detail,
      ].filter(Boolean);
      return `- ${LABEL[p.kind]}: ${bits.join(" / ")}`;
    })
    .join("\n");
}

export async function draftScout(params: {
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  places: Place[];
  season?: string;
}): Promise<ScoutDraft> {
  const hasParking = params.places.some((p) => p.kind === "parking");

  const prompt = `撮影地: ${params.name}
${params.address ? `住所: ${params.address}\n` : ""}座標: ${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}
${params.season ? `想定シーズン: ${params.season}\n` : ""}
周辺の実データ（地図APIで取得した事実。ここに無い固有名詞は使わないこと）:
${formatPlaces(params.places)}

上記をもとに、この撮影地のロケハンメモを作ってください。
- best_time: 撮影のベスト時間帯を選択肢から1つ選ぶ。
- tripod: 三脚が使えそうかを選択肢から1つ選ぶ。人通りが多そうな場所は安全側に。
- permit: 撮影許可の要否の目安を選択肢から1つ選ぶ。寺社・私有地・商業施設は安全側に。
- light: この場所の向き・地形から想像できる光の入り方。断定は避ける。
- access: ${hasParking
    ? "周辺データの駅・駐車場の固有名詞を使って、行き方と車の停め方を具体的に。"
    : "周辺データに駐車場が無いので「周辺の駐車場情報は未取得。現地で確認」と正直に書き、駅からの徒歩を案内する。"}
- notes: 機材や混雑、足元など現地で効く注意点。`;

  return generate<ScoutDraft>(prompt, {
    responseSchema: SCHEMA,
    systemInstruction: SYSTEM,
    temperature: 0.5,
  });
}
