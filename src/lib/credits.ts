import { DB, User } from "./db";

export interface CreditCheckResult {
  allowed: boolean;
  remainingCredits: number;
  monthlyLimit: number;
  usedCredits: number;
  bonusCredits: number;
  reason?: string;
}

export interface CreditTransaction {
  id: string;
  jobId: string;
  userId: string;
  type: "deduct" | "refund";
  amount: number;
  reason: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// 멱등성 보장을 위한 크레딧 트랜잭션 로그
// ---------------------------------------------------------------------------
import fs from "fs";
import path from "path";

const TX_LOG_FILE = path.join(process.cwd(), "data", "db", "credit_transactions.json");

function getTransactions(): CreditTransaction[] {
  try {
    if (!fs.existsSync(TX_LOG_FILE)) return [];
    const raw = fs.readFileSync(TX_LOG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTransaction(tx: CreditTransaction): void {
  try {
    const list = getTransactions();
    list.unshift(tx);
    fs.writeFileSync(TX_LOG_FILE, JSON.stringify(list.slice(0, 5000), null, 2), "utf-8");
  } catch (err) {
    console.error("[saveTransaction error]", err);
  }
}

export function checkUserCredits(userId: string): CreditCheckResult {
  const users = DB.getUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return {
      allowed: false,
      remainingCredits: 0,
      monthlyLimit: 0,
      usedCredits: 0,
      bonusCredits: 0,
      reason: "사용자를 찾을 수 없습니다.",
    };
  }

  if (user.status === "suspended") {
    return {
      allowed: false,
      remainingCredits: 0,
      monthlyLimit: user.monthlyLimit,
      usedCredits: user.usedCredits,
      bonusCredits: user.bonusCredits,
      reason: "이용 정지된 계정입니다. 고객센터에 문의하세요.",
    };
  }

  if (user.role === "admin") {
    return {
      allowed: true,
      remainingCredits: 9999,
      monthlyLimit: 9999,
      usedCredits: user.usedCredits,
      bonusCredits: 9999,
    };
  }

  const monthlyRemaining = Math.max(0, user.monthlyLimit - user.usedCredits);
  const totalRemaining = monthlyRemaining + user.bonusCredits;

  if (totalRemaining <= 0) {
    return {
      allowed: false,
      remainingCredits: 0,
      monthlyLimit: user.monthlyLimit,
      usedCredits: user.usedCredits,
      bonusCredits: user.bonusCredits,
      reason: `이번 달 생성 가능 횟수(${user.monthlyLimit}회)를 모두 소진하셨습니다. 멤버십을 업그레이드해주세요.`,
    };
  }

  return {
    allowed: true,
    remainingCredits: totalRemaining,
    monthlyLimit: user.monthlyLimit,
    usedCredits: user.usedCredits,
    bonusCredits: user.bonusCredits,
  };
}

/**
 * 원자적 크레딧 차감 (Idempotent by jobId)
 */
export async function deductCredit(
  userId: string,
  amount: number = 1,
  jobId?: string
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> {
  // 멱등성 검사: 동일 jobId로 이미 차감된 이력이 있는지 확인
  if (jobId) {
    const existing = getTransactions().find(
      (t) => t.jobId === jobId && t.userId === userId && t.type === "deduct"
    );
    if (existing) {
      const user = DB.getUsers().find((u) => u.id === userId);
      const rem = user ? Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits : 0;
      return { success: true, remainingCredits: rem };
    }
  }

  return DB.updateUsersAtomic<{ success: boolean; error?: string; remainingCredits?: number }>((users) => {
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return { users, result: { success: false, error: "사용자를 찾을 수 없습니다." } };
    }

    const user = users[userIndex];
    if (user.role === "admin") {
      return { users, result: { success: true, remainingCredits: 9999 } };
    }

    const monthlyRemaining = Math.max(0, user.monthlyLimit - user.usedCredits);
    const totalRemaining = monthlyRemaining + user.bonusCredits;

    if (totalRemaining < amount) {
      return { users, result: { success: false, error: "잔여 생성 크레딧이 부족합니다." } };
    }

    if (monthlyRemaining >= amount) {
      user.usedCredits += amount;
    } else {
      const fromMonthly = monthlyRemaining;
      const fromBonus = amount - fromMonthly;
      user.usedCredits += fromMonthly;
      user.bonusCredits = Math.max(0, user.bonusCredits - fromBonus);
    }

    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;

    if (jobId) {
      saveTransaction({
        id: "tx_" + Date.now().toString(36),
        jobId,
        userId,
        type: "deduct",
        amount,
        reason: "영상 생성 요청 크레딧 차감",
        timestamp: new Date().toISOString(),
      });
    }

    const rem = Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits;
    return { users, result: { success: true, remainingCredits: rem } };
  });
}

/**
 * 원자적 크레딧 환불 (Idempotent by jobId)
 */
export async function refundCredit(
  userId: string,
  amount: number = 1,
  reason: string = "생성 실패로 인한 크레딧 자동 환불",
  jobId?: string
): Promise<{ success: boolean; error?: string; remainingCredits?: number }> {
  // 멱등성 검사: 동일 jobId로 이미 환불되었는지 확인
  if (jobId) {
    const existing = getTransactions().find(
      (t) => t.jobId === jobId && t.userId === userId && t.type === "refund"
    );
    if (existing) {
      const user = DB.getUsers().find((u) => u.id === userId);
      const rem = user ? Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits : 0;
      return { success: true, remainingCredits: rem };
    }
  }

  return DB.updateUsersAtomic<{ success: boolean; error?: string; remainingCredits?: number }>((users) => {
    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return { users, result: { success: false } };
    }

    const user = users[userIndex];
    if (user.role === "admin") {
      return { users, result: { success: true, remainingCredits: 9999 } };
    }

    if (user.usedCredits >= amount) {
      user.usedCredits -= amount;
    } else {
      const leftover = amount - user.usedCredits;
      user.usedCredits = 0;
      user.bonusCredits += leftover;
    }

    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;

    if (jobId) {
      saveTransaction({
        id: "tx_" + Date.now().toString(36),
        jobId,
        userId,
        type: "refund",
        amount,
        reason,
        timestamp: new Date().toISOString(),
      });
    }

    DB.addLog({
      adminId: "system",
      adminEmail: "system@shortsmaking.ai",
      action: "CREDIT_REFUND",
      targetId: userId,
      details: { amount, reason, jobId },
    });

    const rem = Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits;
    return { users, result: { success: true, remainingCredits: rem } };
  });
}
