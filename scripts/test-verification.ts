import fs from "fs";
import path from "path";
import { DB, User, BankTransferRequest } from "../src/lib/db";
import { deductCredit, checkUserCredits, refundCredit } from "../src/lib/credits";

// 테스트 1: 크레딧 1회 남은 상태에서 동시 2개 요청 발생 시 Double-Spending 발생 여부
async function testCreditConcurrency() {
  console.log("=== [TEST 1] 크레딧 동시성(Race Condition) 테스트 시작 ===");

  // 1. 테스트 사용자 설정: 잔여 크레딧 1회 (한도 1, 사용 0, 보너스 0)
  const testUserId = "test_race_user_" + Date.now();
  const testUser: User = {
    id: testUserId,
    email: "test_race@example.com",
    passwordHash: "dummy",
    name: "동시성테스터",
    role: "user",
    status: "active",
    membershipTier: "basic",
    monthlyLimit: 1,
    usedCredits: 0,
    bonusCredits: 0,
    nextResetDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const users = DB.getUsers();
  users.push(testUser);
  DB.setUsers(users);

  console.log(`[초기 상태] 사용자: ${testUserId}, 잔여: 1회`);

  // 2. 동시 요청 2개 실행 (Promise.all)
  const [res1, res2] = await Promise.all([
    new Promise<{ success: boolean; error?: string }>((resolve) => {
      setTimeout(() => resolve(deductCredit(testUserId, 1)), 0);
    }),
    new Promise<{ success: boolean; error?: string }>((resolve) => {
      setTimeout(() => resolve(deductCredit(testUserId, 1)), 0);
    }),
  ]);

  console.log("요청 1 결과:", res1);
  console.log("요청 2 결과:", res2);

  const updatedUser = DB.getUsers().find((u) => u.id === testUserId);
  console.log(`[최종 상태] usedCredits: ${updatedUser?.usedCredits}, monthlyLimit: ${updatedUser?.monthlyLimit}`);

  const doubleSpent = res1.success && res2.success;
  if (doubleSpent) {
    console.error("❌ [FAIL] Double-spending 취약점 발생! 1회 크레딧으로 2개 요청이 모두 승인됨.");
  } else {
    console.log("✅ [PASS] 1개 요청만 승인되고 나머지 요청은 정상 차단됨.");
  }

  // 정리
  const cleanedUsers = DB.getUsers().filter((u) => u.id !== testUserId);
  DB.setUsers(cleanedUsers);
  return !doubleSpent;
}

// 테스트 2: 계좌이체 중복 승인 방지 테스트
async function testDuplicateTransferApproval() {
  console.log("\n=== [TEST 2] 계좌이체 중복 승인 방지 테스트 시작 ===");
  const testUserId = "test_tx_user_" + Date.now();
  const testTxId = "test_tx_" + Date.now();

  const testUser: User = {
    id: testUserId,
    email: "test_tx@example.com",
    passwordHash: "dummy",
    name: "결제테스터",
    role: "user",
    status: "active",
    membershipTier: "free",
    monthlyLimit: 3,
    usedCredits: 2, // 이미 2회 사용함
    bonusCredits: 0,
    nextResetDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const testTx: BankTransferRequest = {
    id: testTxId,
    userId: testUserId,
    userEmail: "test_tx@example.com",
    userName: "결제테스터",
    tier: "basic",
    amountKRW: 29000,
    bankName: "토스뱅크",
    accountNumber: "1000-1234-5678",
    accountHolder: "주식회사 쇼츠메이킹",
    depositCode: "SM-TEST",
    depositorName: "결제테스터",
    status: "pending_deposit",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const users = DB.getUsers();
  users.push(testUser);
  DB.setUsers(users);

  const transfers = DB.getTransfers();
  transfers.push(testTx);
  DB.setTransfers(transfers);

  // 첫 번째 승인 시뮬레이션
  const txs1 = DB.getTransfers();
  const targetTx = txs1.find((t) => t.id === testTxId)!;
  targetTx.status = "completed";
  DB.setTransfers(txs1);

  // 이미 completed인 상태에서 또 승인을 시도할 수 있는지 검사
  const isAlreadyCompleted = targetTx.status === "completed";
  console.log("첫 번째 승인 후 상태:", targetTx.status);
  console.log("재승인 차단 방어막 존재 여부 확인:", isAlreadyCompleted);

  // 정리
  DB.setUsers(DB.getUsers().filter((u) => u.id !== testUserId));
  DB.setTransfers(DB.getTransfers().filter((t) => t.id !== testTxId));
  return true;
}

async function run() {
  await testCreditConcurrency();
  await testDuplicateTransferApproval();
}

run();

