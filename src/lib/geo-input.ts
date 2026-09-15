// 「Googleマップで見つけた場所の座標」をそのまま受け取るためのパーサ。
//
// 住所検索には限界がある。たとえば「〒636-0936 奈良県生駒郡平群町福貴」は
// 番地が無いので、地図データ側に "福貴という町域の代表点" しか存在せず、
// 狙った場所から数百m外れた山の中にピンが立つ。これは検索の不具合ではなく、
// 無料の住所データの粒度そのもの。
//
// そこで「Googleマップで正確な位置を出す → 座標をコピー → 貼り付け」という
// 確実な逃げ道を用意する。貼り付けた値はそのまま緯度経度なのでズレようがない。

export type LatLng = { lat: number; lng: number };

const valid = (lat: number, lng: number): LatLng | null =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  Math.abs(lat) <= 90 && Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0)
    ? { lat: +lat.toFixed(6), lng: +lng.toFixed(6) }
    : null;

// 全角の数字・記号を半角へ(コピペで全角が混ざることがある)
const half = (s: string) =>
  s.replace(/[０-９Ａ-Ｚａ-ｚ．，　]/g, (c) =>
    c === "　" ? " " : String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

// 度分秒: 34°37'47.3"N 135°41'37.9"E / N34 37 47.3 E135 41 37.9
function parseDms(s: string): LatLng | null {
  const re = /(\d{1,3})\s*[°度:\s]\s*(\d{1,2})\s*['′分:\s]\s*([\d.]+)\s*["″秒]?\s*([NSEWnsew])|([NSEWnsew])\s*(\d{1,3})\s*[°度:\s]\s*(\d{1,2})\s*['′分:\s]\s*([\d.]+)\s*["″秒]?/g;
  const found: Array<{ deg: number; dir: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const [d, mi, se, dir] = m[1] !== undefined
      ? [m[1], m[2], m[3], m[4]]
      : [m[6], m[7], m[8], m[5]];
    const deg = Number(d) + Number(mi) / 60 + Number(se) / 3600;
    found.push({ deg, dir: dir.toUpperCase() });
  }
  if (found.length !== 2) return null;
  const la = found.find((f) => f.dir === "N" || f.dir === "S");
  const ln = found.find((f) => f.dir === "E" || f.dir === "W");
  if (!la || !ln) return null;
  return valid(la.dir === "S" ? -la.deg : la.deg, ln.dir === "W" ? -ln.deg : ln.deg);
}

// 十進: 34.629792, 135.693866 （カンマ / 空白区切り）
function parseDecimalPair(s: string): LatLng | null {
  const m = s.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,、\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  // 緯度経度は「緯度が先」。日本なら緯度20〜46・経度122〜154なので、
  // 逆に貼られていたら入れ替えて救う。
  let lat = Number(m[1]);
  let lng = Number(m[2]);
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) [lat, lng] = [lng, lat];
  return valid(lat, lng);
}

// GoogleマップのURL。
//   !3d<lat>!4d<lng> … その場所そのものの座標(最優先)
//   @<lat>,<lng>,17z … 画面の中心(場所とは限らないので次点)
//   ?q=<lat>,<lng> / ?ll=<lat>,<lng>
function parseMapUrl(s: string): LatLng | null {
  if (!/https?:\/\//i.test(s)) return null;
  const d = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (d) return valid(Number(d[1]), Number(d[2]));
  const q = s.match(/[?&](?:q|ll|daddr|center)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (q) return valid(Number(q[1]), Number(q[2]));
  const at = s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return valid(Number(at[1]), Number(at[2]));
  return null;
}

/**
 * 入力が「座標そのもの」なら緯度経度を返す。住所や場所名なら null。
 * 対応: 十進 / 度分秒 / GoogleマップのURL。
 * 注意: maps.app.goo.gl の短縮URLは展開しないと座標が入っていないので null を返す
 *       (呼び出し側で「一度開いてから座標をコピーしてください」と案内する)。
 */
export function parseLatLngInput(raw: string): LatLng | null {
  const s = half((raw ?? "").trim());
  if (!s) return null;
  return parseMapUrl(s) ?? parseDms(s) ?? parseDecimalPair(s);
}

/** 短縮URLなど「座標を含まない地図URL」かどうか(案内文の出し分け用) */
export function isUnresolvableMapUrl(raw: string): boolean {
  const s = (raw ?? "").trim();
  return /^https?:\/\//i.test(s) && parseLatLngInput(s) === null &&
    /(goo\.gl|app\.goo\.gl|maps\.apple|yahoo\.co\.jp\/maps|osm\.org|openstreetmap)/i.test(s);
}
