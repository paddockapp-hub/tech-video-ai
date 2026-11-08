import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, BankTransferRequest, MembershipTier } from "@/lib/db";

function generateUniqueDepositCode(existingCodes: Set<string>): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동하기 쉬운 I, O, 0, 1 제외
  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "SM-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  return "SM-" + Date.now().toString(36).toUpperCase().slice(-6);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const config = DB.getConfig();
  const allTransfers = DB.getTransfers();
  const myTransfers = allTransfers.filter((t) => t.userId === user.id);

  const billingAvailable = process.env.VERCEL !== "1";
  return NextResponse.json({
    billingAvailable,
    bankConfig: billingAvailable
      ? {
          bankName: config.bankName,
          accountNumber: config.accountNumber,
          accountHolder: config.accountHolder,
          transferNotice: config.transferNotice,
          tierLimits: config.tierLimits,
          tierPricesKRW: config.tierPricesKRW,
        }
      : null,
    transfers: myTransfers,
  });
}

export async function POST(req: NextRequest) {
  if (process.env.VERCEL === "1") {
    return NextResponse.json(
      {
        error: "영구 데이터베이스와 영상 생성 크레딧이 구성될 때까지 신규 결제 신청을 중지했습니다.",
        code: "BILLING_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await req.json();
  const { tier, depositorName, userMemo } = body;

  const validTiers: MembershipTier[] = ["basic", "standard", "premium"];
  if (!validTiers.includes(tier)) {
    return NextResponse.json(
      { error: "유효하지 않은 멤버십 등급입니다." },
      { status: 400 }
    );
  }

  if (!depositorName || depositorName.trim().length < 2) {
    return NextResponse.json(
      { error: "실제 입금하실 입금자명을 정확히 입력해주세요." },
      { status: 400 }
    );
  }

  const config = DB.getConfig();
  const amountKRW = config.tierPricesKRW[tier as MembershipTier] || 0;

  const transfers = DB.getTransfers();

  // 미확인 대기 신청이 5개 이상 연속으로 있으면 스팸 방지
  const pendingCount = transfers.filter(
    (t) => t.userId === user.id && (t.status === "pending_deposit" || t.status === "verifying")
  ).length;

  if (pendingCount >= 5) {
    return NextResponse.json(
      { error: "이미 대기 중인 입금 신청이 5건 있습니다. 기존 신청을 먼저 확인해주세요." },
      { status: 400 }
    );
  }

  // 중복 없는 6자리 고유 입금 코드 생성
  const existingCodes = new Set(transfers.map((t) => t.depositCode));
  const depositCode = generateUniqueDepositCode(existingCodes);

  const newRequest: BankTransferRequest = {
    id: "tx_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    tier: tier as MembershipTier,
    amountKRW,
    bankName: config.bankName,
    accountNumber: config.accountNumber,
    accountHolder: config.accountHolder,
    depositCode,
    depositorName: depositorName.trim(),
    status: "pending_deposit",
    userMemo: userMemo?.trim() || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  transfers.unshift(newRequest);
  DB.setTransfers(transfers);

  return NextResponse.json({
    success: true,
    transfer: newRequest,
    message: "계좌이체 신청이 완료되었습니다. 안내된 계좌로 입금해주세요.",
  });
}
