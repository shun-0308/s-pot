// YouTubeのいろいろなURL形式から動画IDを取り出し、埋め込みURLを作る。
// 対応: youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = url.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/);
      if (m) return m[2];
    }
  } catch {
    // URLでなければIDそのものとみなす(11文字程度の英数記号)
    if (/^[\w-]{10,12}$/.test(s)) return s;
  }
  return null;
}

export function youtubeEmbed(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}
