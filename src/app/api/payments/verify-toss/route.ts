import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, CreditPurchase } from "@/lib/db";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

// 토스 입금 확인 시뮬레이션 (실제 환경에서는 토스 API 연동 필요)
async function checkTossDeposit(depositCode: string): Promise<{ found: boolean; amount?: number; depositor?: string }> {
  // 시뮬레이션: 실제로는 토스 API를 호출하여 입금 확인
  const transfers = DB.getTransfers();
  const matching = transfers.find((t) => t.depositCode === depositCode && t.status === "verifying");
  
  if (matching) {
    return {
      found: true,
      amount: matching.amountKRW,
      depositor: matching.depositorName
    };
  }
  
  return { found: false };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { purchaseId, tossTransferId } = body;

  const purchases = DB.getCreditPurchases();
  const purchase = purchases.find((p) => p.id === purchaseId);

  if (!purchase) {
    return NextResponse.json({ error: "결제 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  if (purchase.status === "completed") {
    return NextResponse.json({ error: "이미 완료된 결제입니다." }, { status: 400 });
  }

  // 토스 입금 확인
  const depositCheck = await checkTossDeposit(tossTransferId);

  if (depositCheck.found) {
    // 입금 확인 완료
    purchase.status = "completed";
    purchase.completedAt = new Date().toISOString();
    purchase.tossTransferId = tossTransferId;

    // 구매 내역 업데이트
    const allPurchases = DB.getCreditPurchases();
    const pIdx = allPurchases.findIndex((p) => p.id === purchaseId);
    if (pIdx !== -1) {
      allPurchases[pIdx] = purchase;
      DB.setCreditPurchases(allPurchases);
    }

    // 사용자 크레딧 원자적 증가 (동시성 락 보호)
    await DB.updateUsersAtomic((users) => {
      const userIdx = users.findIndex((u) => u.id === purchase.userId);
      if (userIdx !== -1) {
        users[userIdx].bonusCredits = (users[userIdx].bonusCredits || 0) + purchase.credits;
        users[userIdx].updatedAt = new Date().toISOString();
      }
      return { users, result: true };
    });

    return NextResponse.json({
      success: true,
      message: "입금 확인 완료 및 크레딧 지급",
      purchase
    });
  }

  return NextResponse.json({
    success: false,
    message: "입금이 확인되지 않았습니다. 잠시 후 다시 시도해주세요."
  }, { status: 400 });
}
