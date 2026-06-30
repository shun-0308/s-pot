import { supabase, type Visibility } from "./supabase";

// プラン = 行きたいスポットを順番に並べた「旅のしおり」。
// 項目(plan_items)は記録(records)由来でも、地図/検索で見つけたフリーな場所でも置ける。

export type PlanRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  plan_date: string | null; // 予定日 "YYYY-MM-DD"(任意)
  visibility: Visibility;
  created_at: string;
  updated_at: string;
};

export type PlanItemRow = {
  id: string;
  plan_id: string;
  record_id: string | null; // 記録由来なら参照
  sort: number;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  planned_time: string | null; // "10:00" 等(自由入力)
  created_at: string;
};

export type PlanWithItems = PlanRow & { items: PlanItemRow[] };
export type PlanSummary = PlanRow & { item_count: number };

// 自分のプラン一覧(更新が新しい順・項目数つき)
// 注: members/public 読み取りRLSがあるため、明示的に自分のuser_idで絞らないと
//     他人の公開プランまで混ざってしまう。
export async function fetchPlans(): Promise<PlanSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("plans")
    .select("*, plan_items(count)")
    .eq("user_id", user?.id ?? "")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => {
    const agg = (p as { plan_items?: { count: number }[] }).plan_items;
    const item_count = Array.isArray(agg) ? agg[0]?.count ?? 0 : 0;
    const { plan_items: _omit, ...rest } = p as PlanRow & { plan_items?: unknown };
    return { ...(rest as PlanRow), item_count };
  });
}

// 1プラン + 項目(順序つき)
export async function fetchPlan(id: string): Promise<PlanWithItems | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("*, items:plan_items(*)")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // 行なし
    throw error;
  }
  const plan = data as unknown as PlanWithItems;
  plan.items = (plan.items ?? []).sort(
    (a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)
  );
  return plan;
}

export async function createPlan(input: {
  title: string;
  description?: string | null;
  plan_date?: string | null;
  visibility?: Visibility;
}): Promise<PlanRow> {
  const { data, error } = await supabase
    .from("plans")
    .insert({
      title: input.title,
      description: input.description ?? null,
      plan_date: input.plan_date ?? null,
      visibility: input.visibility ?? "private",
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlanRow;
}

export async function updatePlan(
  id: string,
  patch: Partial<Pick<PlanRow, "title" | "description" | "plan_date" | "visibility">>
): Promise<void> {
  const { error } = await supabase
    .from("plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from("plans").delete().eq("id", id);
  if (error) throw error;
}

export type PlanItemInput = {
  record_id?: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
  planned_time?: string | null;
};

export async function addPlanItem(planId: string, input: PlanItemInput, sort: number): Promise<PlanItemRow> {
  const { data, error } = await supabase
    .from("plan_items")
    .insert({
      plan_id: planId,
      record_id: input.record_id ?? null,
      name: input.name,
      address: input.address ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      note: input.note ?? null,
      planned_time: input.planned_time ?? null,
      sort,
    })
    .select()
    .single();
  if (error) throw error;
  await touchPlan(planId);
  return data as PlanItemRow;
}

export async function updatePlanItem(
  id: string,
  patch: Partial<Pick<PlanItemRow, "name" | "address" | "lat" | "lng" | "note" | "planned_time" | "sort">>
): Promise<void> {
  const { error } = await supabase.from("plan_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removePlanItem(id: string): Promise<void> {
  const { error } = await supabase.from("plan_items").delete().eq("id", id);
  if (error) throw error;
}

// 並べ替え(件数は少ない前提で個別update)
export async function reorderPlanItems(items: { id: string; sort: number }[]): Promise<void> {
  await Promise.all(items.map((it) => supabase.from("plan_items").update({ sort: it.sort }).eq("id", it.id)));
}

async function touchPlan(planId: string) {
  await supabase.from("plans").update({ updated_at: new Date().toISOString() }).eq("id", planId);
}

// ── みんなのプラン(公開・参考にする) ──────────────────────────

export type PlanItemWithPhoto = PlanItemRow & { photo_url: string | null };

export type SharedPlanSummary = PlanRow & {
  display_name: string | null;
  avatar_path: string | null;
  item_count: number;
  item_names: string[]; // 検索・プレビュー用(順序つき)
  cover_url: string | null; // 先頭の記録由来項目の写真
};

export type SharedPlan = PlanRow & {
  display_name: string | null;
  avatar_path: string | null;
  items: PlanItemWithPhoto[];
};

// 記録由来の項目(record_id付き)に、その記録の先頭写真の署名URLを紐づける。
// 記録が非公開だとRLSで弾かれ、自然に写真なし(null)になる。
async function recordPhotoMap(recordIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(recordIds)].filter(Boolean);
  if (!ids.length) return new Map();
  const { data } = await supabase
    .from("records")
    .select("id, photos:record_photos(storage_path, sort)")
    .in("id", ids);
  const firstPath = new Map<string, string>();
  for (const r of (data ?? []) as { id: string; photos: { storage_path: string; sort: number }[] }[]) {
    const ph = [...(r.photos ?? [])].sort((a, b) => a.sort - b.sort)[0];
    if (ph) firstPath.set(r.id, ph.storage_path);
  }
  const paths = [...firstPath.values()];
  if (!paths.length) return new Map();
  const { data: signed } = await supabase.storage.from("photos").createSignedUrls(paths, 60 * 60);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl] as const));
  const out = new Map<string, string>();
  for (const [recId, path] of firstPath) {
    const u = urlByPath.get(path);
    if (u) out.set(recId, u);
  }
  return out;
}

// 他ユーザーの公開プラン一覧(おすすめルート検索のもと)
export async function fetchSharedPlans(): Promise<SharedPlanSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("plans")
    .select("*, plan_items(name, record_id, sort)")
    .in("visibility", ["members", "public"])
    .neq("user_id", user?.id ?? "")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  type Row = PlanRow & { plan_items: { name: string; record_id: string | null; sort: number }[] };
  const rows = (data ?? []) as Row[];

  // 投稿者プロフィール
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profMap = new Map<string, { display_name: string | null; avatar_path: string | null }>();
  if (userIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name, avatar_path").in("id", userIds);
    for (const p of (profs ?? []) as { id: string; display_name: string | null; avatar_path: string | null }[])
      profMap.set(p.id, { display_name: p.display_name, avatar_path: p.avatar_path });
  }

  // カバー写真(各プラン先頭の記録由来項目)
  const coverRecordByPlan = new Map<string, string>();
  for (const r of rows) {
    const sorted = [...(r.plan_items ?? [])].sort((a, b) => a.sort - b.sort);
    const firstRec = sorted.find((it) => it.record_id);
    if (firstRec?.record_id) coverRecordByPlan.set(r.id, firstRec.record_id);
  }
  const photoMap = await recordPhotoMap([...coverRecordByPlan.values()]);

  return rows.map((r) => {
    const prof = profMap.get(r.user_id);
    const sorted = [...(r.plan_items ?? [])].sort((a, b) => a.sort - b.sort);
    const coverRec = coverRecordByPlan.get(r.id);
    const { plan_items: _omit, ...rest } = r;
    return {
      ...(rest as PlanRow),
      display_name: prof?.display_name ?? null,
      avatar_path: prof?.avatar_path ?? null,
      item_count: sorted.length,
      item_names: sorted.map((it) => it.name),
      cover_url: coverRec ? photoMap.get(coverRec) ?? null : null,
    };
  });
}

// 公開プラン1件を読み取り(項目＋写真＋投稿者)
export async function fetchSharedPlan(id: string): Promise<SharedPlan | null> {
  const { data, error } = await supabase
    .from("plans")
    .select("*, items:plan_items(*)")
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  const plan = data as unknown as PlanRow & { items: PlanItemRow[] };
  const items = [...(plan.items ?? [])].sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at));

  const { data: prof } = await supabase.from("profiles").select("display_name, avatar_path").eq("id", plan.user_id).single();
  const photoMap = await recordPhotoMap(items.map((i) => i.record_id).filter(Boolean) as string[]);

  return {
    ...(plan as PlanRow),
    display_name: (prof as { display_name: string | null } | null)?.display_name ?? null,
    avatar_path: (prof as { avatar_path: string | null } | null)?.avatar_path ?? null,
    items: items.map((i) => ({ ...i, photo_url: i.record_id ? photoMap.get(i.record_id) ?? null : null })),
  };
}

// 公開プランを自分のプランとして複製(「このプランを参考にする」)。新しいプランのidを返す。
export async function duplicatePlan(srcId: string): Promise<string> {
  const src = await fetchPlan(srcId);
  if (!src) throw new Error("プランが見つかりませんでした");
  const created = await createPlan({
    title: `${src.title}（参考）`,
    description: src.description,
    plan_date: null, // 予定日は自分で決め直す
    visibility: "private",
  });
  for (let i = 0; i < src.items.length; i++) {
    const it = src.items[i];
    await addPlanItem(created.id, {
      record_id: it.record_id, name: it.name, address: it.address,
      lat: it.lat, lng: it.lng, note: it.note, planned_time: it.planned_time,
    }, i);
  }
  return created.id;
}
