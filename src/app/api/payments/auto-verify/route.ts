import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { DB, CreditPurchase } from "@/lib/db";

/**
 * 토스 입금 확인 웹훅 연동
 * 실제 환경에서는 토스 API를 사용하여 입금 확인
 */
async function checkTossDeposit(accountNumber: string, amount: number, depositCode: string): Promise<{ success: boolean; depositId?: string }> {
  // 토스 API 호출 (시뮬레이션)
  // 실제로는 토스 API를 호출하여 입금 내역을 확인
  
  const transfers = DB.getTransfers();
  
  // 입금 내역 찾기
  const recentTransfer = transfers.find((t) => 
    t.accountNumber === accountNumber && 
    t.amountKRW === amount && 
    t.status === "verifying" &&
    t.depositCode === depositCode
  );
  
  if (recentTransfer) {
    return {
      success: true,
      depositId: recentTransfer.id
    };
  }
  
  return { success: false };
}

/**
 * 토스 입금 자동 폴링 (주기적 실행)
 * CRON job이나 Vercel Cron으로 실행되어야 함
 */
export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const config = DB.getConfig();
  const transfers = DB.getTransfers();
  
  // 확인 대기 중인 입금 확인
  const pendingTransfers = transfers.filter((t) => t.status === "verifying");
  
  const results = [];
  
  for (const transfer of pendingTransfers) {
    const check = await checkTossDeposit(
      config.accountNumber,
      transfer.amountKRW,
      transfer.depositCode
    );
    
    if (check.success) {
      // 입금 확인 완료
      transfer.status = "completed";
      transfer.approvedAt = new Date().toISOString();
      
      // 사용자 크레딧 증가
      const users = DB.getUsers();
      const userIdx = users.findIndex((u) => u.id === transfer.userId);
      
      if (userIdx !== -1) {
        users[userIdx].bonusCredits = (users[userIdx].bonusCredits || 0) + 10; // 기본 10회 지급
        users[userIdx].updatedAt = new Date().toISOString();
        DB.setUsers(users);
      }
      
      DB.setTransfers(transfers);
      results.push({ transferId: transfer.id, status: "approved" });
    }
  }
  
  return NextResponse.json({
    checked: pendingTransfers.length,
    approved: results.length,
    results
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { purchaseId, accountNumber, amount, depositCode } = body;

  // 수동 입금 확인 요청
  const check = await checkTossDeposit(accountNumber, amount, depositCode);
  
  if (check.success) {
    const purchases = DB.getCreditPurchases();
    const purchase = purchases.find((p) => p.id === purchaseId);
    
    if (purchase) {
      purchase.status = "completed";
      purchase.completedAt = new Date().toISOString();
      purchase.tossTransferId = check.depositId;
      
      // 사용자 크레딧 증가
      const users = DB.getUsers();
      const userIdx = users.findIndex((u) => u.id === purchase.userId);
      
      if (userIdx !== -1) {
        users[userIdx].bonusCredits = (users[userIdx].bonusCredits || 0) + purchase.credits;
        users[userIdx].updatedAt = new Date().toISOString();
        DB.setUsers(users);
      }
      
      DB.addCreditPurchase(purchase);
    }
    
    return NextResponse.json({ success: true, message: "입금 확인 완료" });
  }
  
  return NextResponse.json({ success: false, message: "입금 확인 실패" }, { status: 400 });
}
