import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PLANS: Record<string, number> = { basic: 9900, pro: 29900 }; // 금액은 서버에서만 결정(조작 방지)

function sb(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("DB 설정 없음");
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
      Prefer: "return=representation", ...(init.headers || {}) },
  });
}

// 이용자: 입금 신청
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 40);
  const depositor = String(b.depositor || "").trim().slice(0, 40);
  const amount = PLANS[b.plan];
  if (!name || !depositor || !amount) return NextResponse.json({ error: "입력값 확인" }, { status: 400 });
  try {
    const r = await sb("transfer_requests", { method: "POST", body: JSON.stringify({ name, depositor, plan: b.plan, amount }) });
    if (!r.ok) return NextResponse.json({ error: "저장 실패" }, { status: 502 });
    const [row] = await r.json();
    return NextResponse.json({ id: row.id, amount, status: row.status });
  } catch { return NextResponse.json({ error: "서비스 준비 중" }, { status: 503 }); }
}

// 관리자: 신청 목록 / 입금 확인 (헤더 x-admin-token = ADMIN_TOKEN)
function isAdmin(req: Request) {
  return !!process.env.ADMIN_TOKEN && req.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  const r = await sb("transfer_requests?order=created_at.desc&limit=100");
  return NextResponse.json(await r.json());
}
export async function PATCH(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "권한 없음" }, { status: 401 });
  const { id, status } = await req.json();
  if (!["confirmed", "rejected"].includes(status)) return NextResponse.json({ error: "status 오류" }, { status: 400 });
  const r = await sb(`transfer_requests?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
  return NextResponse.json(await r.json());
}
