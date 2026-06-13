// EXIF GPS / 撮影日時パーサ(JPEG)— 外部ライブラリ不要
// 注意: スクショ・LINE経由保存・加工アプリ書き出しはGPSが消える(手動フォールバック前提)
// HEIC対応が必要になったら exifr ライブラリの採用を検討(仕様書 §3, §7)

export type ExifResult = { lat?: number | null; lon?: number | null; date?: string | null };

export async function readExif(file: File): Promise<ExifResult> {
  const buf = await file.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return {};
  let off = 2;
  while (off < dv.byteLength - 4) {
    const marker = dv.getUint16(off);
    if ((marker & 0xff00) !== 0xff00) break;
    const size = dv.getUint16(off + 2);
    if (marker === 0xffe1 && dv.getUint32(off + 4) === 0x45786966) {
      try { return parseTiff(dv, off + 10); } catch { return {}; }
    }
    off += 2 + size;
  }
  return {};
}

function parseTiff(dv: DataView, base: number): ExifResult {
  const little = dv.getUint16(base) === 0x4949;
  const u16 = (o: number) => dv.getUint16(base + o, little);
  const u32 = (o: number) => dv.getUint32(base + o, little);
  const rat = (o: number) => u32(o) / (u32(o + 4) || 1);
  const str = (o: number, n: number) => {
    let s = "";
    for (let i = 0; i < n; i++) {
      const c = dv.getUint8(base + o + i);
      if (c) s += String.fromCharCode(c);
    }
    return s;
  };
  const entries = (ifd: number) => {
    const n = u16(ifd);
    const m: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      m[u16(e)] = e;
    }
    return m;
  };
  const dataOff = (e: number) => {
    const type = u16(e + 2);
    const count = u32(e + 4);
    const size = (({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8 } as Record<number, number>)[type] || 1) * count;
    return size > 4 ? u32(e + 8) : e + 8;
  };
  const ifd0 = entries(u32(4));
  let lat: number | null = null;
  let lon: number | null = null;
  let date: string | null = null;
  if (ifd0[0x8825]) {
    const g = entries(u32(dataOff(ifd0[0x8825])));
    if (g[2] && g[4]) {
      const lo = dataOff(g[2]);
      const no = dataOff(g[4]);
      lat = rat(lo) + rat(lo + 8) / 60 + rat(lo + 16) / 3600;
      lon = rat(no) + rat(no + 8) / 60 + rat(no + 16) / 3600;
      if (g[1] && str(dataOff(g[1]), 1) === "S") lat = -lat;
      if (g[3] && str(dataOff(g[3]), 1) === "W") lon = -lon;
    }
  }
  if (ifd0[0x8769]) {
    const ex = entries(u32(dataOff(ifd0[0x8769])));
    if (ex[0x9003]) date = str(dataOff(ex[0x9003]), 19);
  }
  if (!date && ifd0[0x0132]) date = str(dataOff(ifd0[0x0132]), 19);
  return { lat, lon, date };
}

// "2026:06:15 10:30:00" → "2026.06.15"
export const fmtExifDate = (d?: string | null): string =>
  d ? d.slice(0, 10).replaceAll(":", ".") : "";

// "2026:06:15 10:30:00" → "2026-06-15"(DB date型用)
export const exifDateToISO = (d?: string | null): string | null =>
  d ? d.slice(0, 10).replaceAll(":", "-") : null;
