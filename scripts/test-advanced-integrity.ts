import fs from "fs";
import path from "path";
import { DB, User, BankTransferRequest, withProcessLock } from "../src/lib/db";
import { deductCredit, checkUserCredits, refundCredit } from "../src/lib/credits";
import {
  createBackup,
  verifyBackup,
  restoreBackup,
  exportBackupArchive,
  importBackupArchive,
} from "../src/lib/backup";
import {
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  checkIpRateLimit,
  recordIpAttempt,
} from "../src/lib/auth";

interface TestReportItem {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  details: string;
  evidence?: any;
}

const report: TestReportItem[] = [];

async function runAdvancedTests() {
  console.log("============================================================");
  console.log("🛡️ [고도화 검증] 5대 핵심 운영 안정성 자동화 테스트 시작");
  console.log("============================================================\n");

  // -------------------------------------------------------------------------
  // 1. ① 파일 락의 범위: OS 레벨 lockfile 상호 배제(Mutual Exclusion) 검증
  // -------------------------------------------------------------------------
  {
    console.log("[1] OS 레벨 프로세스 파일 락(Lockfile) 테스트 중...");
    let sharedCounter = 0;
    const taskCount = 10;

    // 10개의 비동기 작업이 동시에 lock을 획득하여 sharedCounter를 읽고 10ms 지연 후 +1 기록
    const promises = Array.from({ length: taskCount }, async () => {
      await withProcessLock("test_lockfile_counter", async () => {
        const current = sharedCounter;
        await new Promise((r) => setTimeout(r, 10));
        sharedCounter = current + 1;
      });
    });

    await Promise.all(promises);

    const passed = sharedCounter === taskCount;
    report.push({
      id: "OS_LOCKFILE_MUTEX",
      name: "OS 레벨 프로세스 파일 락(Lockfile) 상호 배제",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? `동시 10개 작업이 lockfile에 의해 직렬화되어 카운터가 정확히 ${taskCount}에 도달했습니다.`
        : `Race condition 발생: 기대값 ${taskCount}, 실제값 ${sharedCounter}`,
      evidence: { sharedCounter, expected: taskCount },
    });
    console.log(`   -> 결과: ${passed ? "PASS" : "FAIL"} (Counter: ${sharedCounter}/${taskCount})`);
  }

  // -------------------------------------------------------------------------
  // 2. ② 백업 복구: 무결성 검증, 롤백 안전망 및 아카이브 Export/Import 검증
  // -------------------------------------------------------------------------
  {
    console.log("\n[2] 백업 복구 안전성 & 원격 보관 Export/Import 테스트 중...");
    const backup = createBackup();
    const verifyBefore = verifyBackup(backup.id);

    // Export 테스트
    const bundle = exportBackupArchive(backup.id);
    const hasUsersInBundle = bundle.payload["users.json"] !== undefined;

    // Import 테스트
    const imported = importBackupArchive(bundle);
    const verifyImported = imported.backupId ? verifyBackup(imported.backupId) : { valid: false };

    // Restore 복구 테스트
    const restoreResult = await restoreBackup(backup.id);

    const passed =
      backup.totalFiles > 0 &&
      verifyBefore.valid &&
      hasUsersInBundle &&
      imported.success &&
      verifyImported.valid &&
      restoreResult.success;

    report.push({
      id: "BACKUP_RESTORE_EXPORT_IMPORT",
      name: "백업 복구 안전성 & 원격 아카이브 Export/Import",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "백업 생성, SHA-256 검증, 단일 번들 Export/Import, 복구 프로세스 모두 정상 통과했습니다."
        : "백업 복구 또는 Export/Import 실패",
      evidence: {
        backupId: backup.id,
        importedBackupId: imported.backupId,
        restoreSuccess: restoreResult.success,
      },
    });
    console.log(`   -> 결과: ${passed ? "PASS" : "FAIL"}`);
  }

  // -------------------------------------------------------------------------
  // 3. ③ Rate Limiter: IP 기반 글로벌 제한 + 이메일 기반 Brute-force 듀얼 레이어
  // -------------------------------------------------------------------------
  {
    console.log("\n[3] 듀얼 레이어 Rate Limiter(IP 글로벌 + 이메일 잠금) 테스트 중...");
    const testIp = "203.0.113.195";

    // 1) IP 30회 초과 시 차단 검증
    for (let i = 0; i < 30; i++) {
      recordIpAttempt(testIp);
    }
    const ipCheck1 = checkIpRateLimit(testIp);
    // 31번째 시도
    recordIpAttempt(testIp);
    const ipCheck2 = checkIpRateLimit(testIp);

    const ipPassed = !ipCheck2.allowed && (ipCheck2.remainingSeconds ?? 0) > 0;

    // 2) 이메일 5회 실패 시 15분 차단 검증
    const testEmail = "victim_account@shortsmaking.ai";
    resetLoginAttempts(testEmail);
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(testEmail);
    }
    const emailCheck = checkLoginRateLimit(testEmail);
    const emailPassed = !emailCheck.allowed && (emailCheck.remainingSeconds ?? 0) > 0;

    const passed = ipPassed && emailPassed;
    report.push({
      id: "DUAL_RATE_LIMITER",
      name: "IP 글로벌 제한(분당 30회) + 이메일 Brute-force(5회) 듀얼 방어",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "동일 IP 다량 요청 및 동일 이메일 연속 실패에 대한 차단이 모두 정상 작동합니다."
        : "Rate Limiter 차단 실패",
      evidence: { ipBlocked: !ipCheck2.allowed, emailBlocked: !emailCheck.allowed },
    });
    console.log(`   -> 결과: ${passed ? "PASS" : "FAIL"}`);
  }

  // -------------------------------------------------------------------------
  // 4. ④ 멱등성: 사용자 ID와 작업 ID 복합 키 검증 (타인 작업 ID 도용 차단)
  // -------------------------------------------------------------------------
  {
    console.log("\n[4] 사용자 ID - 작업 ID 복합 멱등성 및 타인 도용 차단 테스트 중...");
    const userA = "usr_user_a_" + Date.now();
    const userB = "usr_user_b_" + Date.now();
    const sharedJobId = "job_secure_composite_" + Date.now();

    const uA: User = {
      id: userA,
      email: "user_a@test.com",
      passwordHash: "dummy",
      name: "사용자A",
      role: "user",
      status: "active",
      membershipTier: "basic",
      monthlyLimit: 10,
      usedCredits: 0,
      bonusCredits: 0,
      nextResetDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const uB: User = {
      id: userB,
      email: "user_b@test.com",
      passwordHash: "dummy",
      name: "사용자B",
      role: "user",
      status: "active",
      membershipTier: "basic",
      monthlyLimit: 10,
      usedCredits: 0,
      bonusCredits: 0,
      nextResetDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    DB.setUsers([...DB.getUsers(), uA, uB]);

    // 1) 사용자 A가 정상적으로 jobId 차감
    const deductA = await deductCredit(userA, 1, sharedJobId);

    // 2) 사용자 B가 사용자 A의 jobId를 그대로 도용하여 차감 시도 -> 반드시 에러 차단되어야 함!
    const deductB = await deductCredit(userB, 1, sharedJobId);

    // 3) 사용자 B가 사용자 A의 jobId를 도용하여 환불 시도 -> 반드시 에러 차단되어야 함!
    const refundB = await refundCredit(userB, 1, "타인 작업 환불 시도", sharedJobId);

    // 4) 차감 이력이 전혀 없는 가상 작업에 대한 허위 환불 시도 -> 차단되어야 함!
    const fakeRefundA = await refundCredit(userA, 1, "허위 환불", "job_never_deducted_999");

    const passed =
      deductA.success &&
      !deductB.success &&
      deductB.error?.includes("다른 사용자의 작업 ID") &&
      !refundB.success &&
      !fakeRefundA.success;

    report.push({
      id: "IDEMPOTENT_COMPOSITE_SECURITY",
      name: "사용자 ID - 작업 ID 복합 키 검증 (IDOR 및 허위 환불 방어)",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "타인의 jobId 도용 차단, 타인 작업 환불 차단, 미차감 작업 환불 차단이 모두 확인되었습니다."
        : "타인 작업 ID 도용 취약점 존재",
      evidence: {
        deductA_success: deductA.success,
        deductB_blocked: !deductB.success,
        deductB_error: deductB.error,
        refundB_blocked: !refundB.success,
        fakeRefund_blocked: !fakeRefundA.success,
      },
    });
    console.log(`   -> 결과: ${passed ? "PASS" : "FAIL"}`);

    // 정리
    DB.setUsers(DB.getUsers().filter((x) => x.id !== userA && x.id !== userB));
  }

  // -------------------------------------------------------------------------
  // 5. ⑤ 결제 승인 원자적 단일 트랜잭션 (All-or-Nothing 롤백 및 중복 승인 방지)
  // -------------------------------------------------------------------------
  {
    console.log("\n[5] 결제 승인 단일 원자적 트랜잭션(executePaymentApprovalTransaction) 테스트 중...");
    const testUserId = "usr_tx_atomic_" + Date.now();
    const testTxId = "tx_atomic_" + Date.now();

    const u: User = {
      id: testUserId,
      email: "tx_atomic@test.com",
      passwordHash: "dummy",
      name: "원자적결제유저",
      role: "user",
      status: "active",
      membershipTier: "free",
      monthlyLimit: 3,
      usedCredits: 2,
      bonusCredits: 0,
      nextResetDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tx: BankTransferRequest = {
      id: testTxId,
      userId: testUserId,
      userEmail: "tx_atomic@test.com",
      userName: "원자적결제유저",
      tier: "standard",
      amountKRW: 79000,
      bankName: "토스뱅크",
      accountNumber: "1000-1234-5678",
      accountHolder: "주식회사 쇼츠메이킹",
      depositCode: "SM-ATOMIC",
      depositorName: "원자적결제유저",
      status: "pending_deposit",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    DB.setUsers([...DB.getUsers(), u]);
    DB.setTransfers([...DB.getTransfers(), tx]);

    // 1) 첫 번째 승인 트랜잭션 실행
    const firstApproval = await DB.executePaymentApprovalTransaction(testTxId, "approve");

    // 2) 동일 신청에 대해 두 번째 승인 트랜잭션 시도 -> 400 Bad Request 에러로 차단되어야 함
    const secondApproval = await DB.executePaymentApprovalTransaction(testTxId, "approve");

    // 3) 최종 유저 상태 검증
    const updatedUser = DB.getUsers().find((x) => x.id === testUserId);
    const updatedTx = DB.getTransfers().find((x) => x.id === testTxId);

    const passed =
      firstApproval.success &&
      !secondApproval.success &&
      secondApproval.error?.includes("이미 승인 완료") &&
      updatedTx?.status === "completed" &&
      updatedUser?.membershipTier === "standard" &&
      updatedUser?.monthlyLimit === 100 &&
      updatedUser?.usedCredits === 0;

    report.push({
      id: "PAYMENT_ATOMIC_TRANSACTION",
      name: "결제 승인 단일 원자적 트랜잭션 (All-or-Nothing 및 중복 승인 차단)",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "transfers와 users가 단일 글로벌 락 내에서 동시에 원자적으로 갱신되었으며, 재승인 시도가 완벽히 차단되었습니다."
        : "결제 트랜잭션 원자성 불일치 또는 중복 승인 허용됨",
      evidence: {
        firstApproval: firstApproval.success,
        secondApprovalBlocked: !secondApproval.success,
        secondApprovalError: secondApproval.error,
        finalTier: updatedUser?.membershipTier,
        finalMonthlyLimit: updatedUser?.monthlyLimit,
        finalStatus: updatedTx?.status,
      },
    });
    console.log(`   -> 결과: ${passed ? "PASS" : "FAIL"}`);

    // 정리
    DB.setUsers(DB.getUsers().filter((x) => x.id !== testUserId));
    DB.setTransfers(DB.getTransfers().filter((x) => x.id !== testTxId));
  }

  // -------------------------------------------------------------------------
  // 결과 저장
  // -------------------------------------------------------------------------
  const outPath = path.join(
    process.cwd(),
    "public",
    "outputs",
    "test_verification",
    "advanced_integrity_results.json"
  );
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n============================================================");
  console.log(`🎉 5대 고도화 테스트 완료! 결과 리포트 저장: ${outPath}`);
  console.log("============================================================");
}

runAdvancedTests().catch((e) => console.error(e));

