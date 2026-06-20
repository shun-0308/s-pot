import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ログイン中ユーザーのメールが「S-Labの有効会員(または管理者)」かをサーバーで確認する。
// S-pot自身のトークンでメールを確定し、S-Lab側のRPC is_lab_member を呼ぶ。
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ member: false }, { status: 200 });

  const SP_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SP_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const SLAB_URL = process.env.SLAB_SUPABASE_URL;
  const SLAB_ANON = process.env.SLAB_SUPABASE_ANON_KEY;

  try {
    // 1) トークンからメールを確定(S-pot側で検証)
    const sp = createClient(SP_URL, SP_ANON);
    const { data, error } = await sp.auth.getUser(token);
    const email = data.user?.email;
    if (error || !email) return NextResponse.json({ member: false }, { status: 200 });

    // S-Lab連携が未設定なら会員判定はできない(falseで返す)
    if (!SLAB_URL || !SLAB_ANON) {
      return NextResponse.json({ member: false, reason: "slab-unconfigured" }, { status: 200 });
    }

    // 2) S-LabのRPCで会員かどうか問い合わせ(true/falseだけ返る)
    const res = await fetch(`${SLAB_URL}/rest/v1/rpc/is_lab_member`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SLAB_ANON,
        Authorization: `Bearer ${SLAB_ANON}`,
      },
      body: JSON.stringify({ p_email: email }),
    });
    if (!res.ok) return NextResponse.json({ member: false }, { status: 200 });
    const member = (await res.json()) === true;
    return NextResponse.json({ member }, { status: 200 });
  } catch {
    return NextResponse.json({ member: false }, { status: 200 });
  }
}
