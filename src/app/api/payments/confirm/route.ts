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

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json();
  const { purchaseId, action } = body;

  if (!purchaseId || !action) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const purchases = DB.getCreditPurchases();
  const purchase = purchases.find((p) => p.id === purchaseId);

  if (!purchase) {
    return NextResponse.json({ error: "결제 내역을 찾을 수 없습니다." }, { status: 404 });
  }

  if (action === "approve") {
    // 결제 승인 및 크레딧 추가
    purchase.status = "completed";
    purchase.completedAt = new Date().toISOString();

    // 사용자 크레딧 증가
    const users = DB.getUsers();
    const userIdx = users.findIndex((u) => u.id === purchase.userId);

    if (userIdx !== -1) {
      users[userIdx].bonusCredits = (users[userIdx].bonusCredits || 0) + purchase.credits;
      users[userIdx].updatedAt = new Date().toISOString();
      DB.setUsers(users);
    }

    DB.addCreditPurchase(purchase);
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREDIT_PURCHASE_APPROVE",
      targetId: purchaseId,
      details: {
        userId: purchase.userId,
        credits: purchase.credits,
        priceKRW: purchase.priceKRW,
        paymentMethod: purchase.paymentMethod,
      },
    });

    return NextResponse.json({ success: true, purchase });
  }

  if (action === "reject") {
    purchase.status = "failed";
    DB.addCreditPurchase(purchase);
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "CREDIT_PURCHASE_REJECT",
      targetId: purchaseId,
      details: { userId: purchase.userId },
    });

    return NextResponse.json({ success: true, purchase });
  }

  return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
}
