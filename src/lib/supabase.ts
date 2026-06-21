import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      // ログイン状態をブラウザに保存し、トークンを自動更新。
      // 開発サーバー再起動やタブを閉じても記録が消えたように見えないようにする。
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export type Visibility = "private" | "members" | "public";

// ロケハン情報(カメラマン向け撮影地メモ)
export type ScoutInfo = {
  best_time?: string; // ベスト時間帯(朝焼け/午前/午後/夕暮れ/夜景)
  tripod?: string; // 三脚(可/条件付き/不可)
  permit?: string; // 撮影許可(不要/要確認/要申請)
  light?: string; // 光のメモ
  access?: string; // 駐車場・アクセス
  notes?: string; // 機材・混雑・その他
};

export type RecordRow = {
  id: string;
  user_id: string;
  pref_code: number | null; // 日本の記録のみ(JIS都道府県コード)
  country_code: string; // ISO 3166-1 numeric。日本 = "392"
  name: string;
  address: string | null; // 位置判定に使う住所/場所名(任意)
  youtube_url: string | null; // 関連するYouTube動画(任意)
  taken_at: string | null;
  body: string | null;
  lat: number | null;
  lng: number | null;
  visibility: Visibility;
  scout: ScoutInfo | null;
  created_at: string;
};

export type RecordPhotoRow = {
  id: string;
  record_id: string;
  storage_path: string;
  sort: number;
};

export type FavoriteRow = {
  id: string;
  user_id: string;
  record_id: string;
  created_at: string;
};
