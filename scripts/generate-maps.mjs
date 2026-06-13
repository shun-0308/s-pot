#!/usr/bin/env node
// 水彩アート地図の一括生成スクリプト
// 使い方:
//   OPENAI_API_KEY=sk-... node scripts/generate-maps.mjs --provider openai --only 13   (まず1県テスト)
//   OPENAI_API_KEY=sk-... node scripts/generate-maps.mjs --provider openai             (全県)
//   GEMINI_API_KEY=...   node scripts/generate-maps.mjs --provider gemini
// 仕様:
//   art-guides/NN_guide.png を読み、public/maps/NN.png に保存(既存はスキップ=再開可能)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GUIDES = path.join(ROOT, "art-guides");
const OUT = path.join(ROOT, "public", "maps");

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const provider = getArg("provider") ?? (process.env.OPENAI_API_KEY ? "openai" : "gemini");
const only = getArg("only"); // 県コード1つだけ(テスト用)
const quality = getArg("quality") ?? "medium"; // low / medium / high

// 県名(JISコード順)
const PREFS = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "japan-pref-paths.json"), "utf8"));
const nameOf = (code) => PREFS.find((p) => String(p.id) === String(code))?.name ?? "";

// スタイル参考画像(任意)。art-guides/style-ref.png があれば同梱される
const STYLE_REF = path.join(GUIDES, "style-ref.png");

// ガイドv3(市区町村境界入り実輪郭)用・地形のみ方針。docs/art-prompts.md と同内容を保つこと
const promptFor = (name) => `The attached image is a precise map guide of ${name}, Japan. Repaint it as a hand-painted watercolor illustrated map, storybook style, top-down view, while keeping every outline and boundary line exactly where it is.

Color meaning in the guide:
- khaki area = the target prefecture (${name}): paint with soft watercolor greens and terrain (hills, forests, rivers as thin pale-blue lines)
- thin white lines inside the khaki area = municipality boundaries: keep them all, as delicate white boundary lines
- cream area = neighboring land: leave pale and quiet, plain paper tone
- light blue area = sea: gentle watercolor water with soft washes
${fs.existsSync(STYLE_REF) ? "The second image is a style reference: match its touch and palette.\n" : ""}
Style: soft pastel colors, gentle paper texture, Japanese travel journal aesthetic, warm and nostalgic, beautiful watercolor washes, picture book illustration style, high detail, clean background.

Strict rules: do not move, simplify or stylize any outline or boundary line. Terrain only — no landmarks, no buildings, no man-made structures. No text, no labels, no roads, no GPS map appearance. Flat watercolor, no shadows, no 3D.
CRITICAL: paint ONLY the khaki area. The cream neighboring land must remain plain pale paper — no green washes, no terrain, no rivers there. Lakes and inland water inside the khaki area (shown as light blue in the guide) must stay as water, never painted over with green. The border between the painted prefecture and the pale neighbors must stay instantly readable.
Output: same aspect ratio and same composition as the attached guide.`;

// PNGの寸法(IHDR)を読む
function pngSize(file) {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

async function genOpenAI(guidePath, name) {
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", promptFor(name));
  form.append("size", "auto");
  form.append("quality", quality);
  form.append("image[]", new Blob([fs.readFileSync(guidePath)], { type: "image/png" }), "guide.png");
  if (fs.existsSync(STYLE_REF)) {
    form.append("image[]", new Blob([fs.readFileSync(STYLE_REF)], { type: "image/png" }), "style-ref.png");
  }
  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return Buffer.from(json.data[0].b64_json, "base64");
}

async function genGemini(guidePath, name) {
  const parts = [
    { text: promptFor(name) },
    { inline_data: { mime_type: "image/png", data: fs.readFileSync(guidePath).toString("base64") } },
  ];
  if (fs.existsSync(STYLE_REF)) {
    parts.push({ inline_data: { mime_type: "image/png", data: fs.readFileSync(STYLE_REF).toString("base64") } });
  }
  const body = { contents: [{ parts }] };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData || p.inline_data);
  const data = (part?.inlineData ?? part?.inline_data)?.data;
  if (!data) throw new Error("Gemini: 画像が返りませんでした");
  return Buffer.from(data, "base64");
}

async function main() {
  if (provider === "openai" && !process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY がありません");
  if (provider === "gemini" && !process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY がありません");
  fs.mkdirSync(OUT, { recursive: true });

  const guides = fs.readdirSync(GUIDES).filter((f) => f.endsWith("_guide.png")).sort();
  let ok = 0, skip = 0, fail = 0;

  for (const g of guides) {
    const code = String(parseInt(g.slice(0, 2), 10)); // "01" → "1"
    if (only && code !== String(parseInt(only, 10))) continue;
    const outFile = path.join(OUT, `${code}.png`);
    if (fs.existsSync(outFile)) { console.log(`skip ${code} (既にあります)`); skip++; continue; }

    const guidePath = path.join(GUIDES, g);
    const name = nameOf(code);
    process.stdout.write(`生成中 ${code} ${name} ... `);
    try {
      const buf = provider === "openai" ? await genOpenAI(guidePath, name) : await genGemini(guidePath, name);
      const tmp = outFile + ".tmp.png";
      fs.writeFileSync(tmp, buf);
      // ガイドと同じ縦横比に揃える(macOSのsipsを使用)
      const { w, h } = pngSize(guidePath);
      try { execFileSync("sips", ["-z", String(h), String(w), tmp], { stdio: "ignore" }); } catch {}
      fs.renameSync(tmp, outFile);
      console.log(`OK → public/maps/${code}.png`);
      ok++;
      await new Promise((r) => setTimeout(r, 3000)); // レート制限よけ
    } catch (e) {
      console.log(`失敗: ${e.message}`);
      fail++;
    }
  }
  console.log(`\n完了: 生成 ${ok} / スキップ ${skip} / 失敗 ${fail}`);
  if (fail) console.log("失敗分は同じコマンドの再実行で続きから生成されます。");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
