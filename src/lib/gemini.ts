// Gemini 呼び出しの薄いラッパ（サーバー専用）。
//
// 設計方針: **tools は使わない**。
//   googleSearch / googleMaps の grounding は無料枠に割り当てが無く、全モデルで
//   429 RESOURCE_EXHAUSTED になる（2026-07 実測）。一方 tools 無し + responseSchema の
//   構造化出力は無料枠で正常に動く。よって「事実は地図API（lib/nearby.ts）で取り、
//   Gemini は与えられた事実の要約・文章化だけを担当する」という分業にしている。
//   → 副次的な利点として、モデルが施設名を捏造するリスクが構造的に無くなる。

const BASE = "https://generativelanguage.googleapis.com/v1beta";

// 無料枠で 200 を返すことを実測したモデルを優先順に。
// 先頭が 429/503 の時のために複数用意する（2.5系は「新規ユーザーには提供終了」で404）。
const MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview"];

export class GeminiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "GeminiError";
  }
}

type GenerateOptions = {
  /** JSON Schema 相当（type/properties/items/required/enum などのサブセット） */
  responseSchema?: Record<string, unknown>;
  systemInstruction?: string;
  temperature?: number;
};

/**
 * Gemini でテキスト or 構造化JSONを生成する。
 * responseSchema を渡すと、パース済みのオブジェクトを返す。
 */
export async function generate<T = string>(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY が未設定です", 500);

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.responseSchema
        ? { responseMimeType: "application/json", responseSchema: opts.responseSchema }
        : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  let lastStatus = 500;
  let lastMessage = "Gemini の呼び出しに失敗しました";

  for (const model of MODELS) {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) {
        lastMessage = "Gemini が空の応答を返しました";
        continue;
      }
      if (!opts.responseSchema) return text as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        lastMessage = "Gemini の応答をJSONとして解釈できませんでした";
        continue;
      }
    }

    lastStatus = res.status;
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    lastMessage = err?.error?.message ?? `HTTP ${res.status}`;

    // 429(枠切れ) / 503(混雑) / 404(モデル提供終了) は次のモデルで再挑戦する価値がある
    if (![429, 503, 404, 500].includes(res.status)) break;
  }

  throw new GeminiError(lastMessage, lastStatus);
}
