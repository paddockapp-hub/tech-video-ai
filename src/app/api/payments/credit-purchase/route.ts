import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, CreditPurchase } from "@/lib/db";

async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }
  return user;
}

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const config = DB.getConfig();
  return NextResponse.json({ packages: config.creditPackages });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { packageId, paymentMethod } = body;

  if (!packageId || !paymentMethod) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const config = DB.getConfig();
  const pkg = config.creditPackages.find((p) => p.id === packageId);

  if (!pkg) {
    return NextResponse.json({ error: "존재하지 않는 패키지입니다." }, { status: 404 });
  }

  // 결제 주문 생성
  const purchaseId = "po_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  if (paymentMethod === "toss") {
    // 토스 계좌 이체 정보 반환
    return NextResponse.json({
      success: true,
      purchaseId,
      paymentMethod: "toss",
      bankName: config.bankName,
      accountNumber: config.accountNumber,
      accountHolder: config.accountHolder,
      amount: pkg.priceKRW,
      depositCode: purchaseId.toUpperCase(),
      instructions: config.transferNotice,
    });
  } else if (paymentMethod === "gpt") {
    // GPT 계정 연동 필요
    return NextResponse.json({
      success: true,
      purchaseId,
      paymentMethod: "gpt",
      requiresOpenAIAPIKey: true,
      amount: pkg.priceKRW,
    });
  }

  return NextResponse.json({ error: "지원하지 않는 결제 방법입니다." }, { status: 400 });
}
