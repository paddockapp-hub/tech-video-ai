import fs from "fs";
import path from "path";
import { DB, User, BankTransferRequest } from "../src/lib/db";
import { deductCredit, checkUserCredits, refundCredit } from "../src/lib/credits";
import { createBackup, verifyBackup, restoreBackup, listBackups } from "../src/lib/backup";
import { checkLoginRateLimit, recordFailedLogin, resetLoginAttempts } from "../src/lib/auth";

interface TestReportItem {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "WARNING" | "NOT TESTED";
  details: string;
  evidence?: any;
}

const report: TestReportItem[] = [];

async function runAllTests() {
  console.log("============================================================");
  console.log("🚀 [3차 최종 출시 준비] 실전 자동화 검증 테스트 스위트 시작");
  console.log("============================================================\n");

  // -------------------------------------------------------------------------
  // 1. 크레딧 1회 잔여 상태 동시 요청 2건 테스트
  // -------------------------------------------------------------------------
  {
    const userId = "test_user_c2_" + Date.now();
    const u: User = {
      id: userId,
      email: "c2@test.com",
      passwordHash: "dummy",
      name: "동시성테스터2",
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
    DB.setUsers([...DB.getUsers(), u]);

    const [r1, r2] = await Promise.all([
      deductCredit(userId, 1, "job_c2_1"),
      deductCredit(userId, 1, "job_c2_2"),
    ]);

    const successes = [r1, r2].filter((r) => r.success).length;
    const passed = successes === 1;

    report.push({
      id: "CREDIT_CONCURRENCY_2",
      name: "크레딧 1회 상태 동시 2건 요청",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "정확히 1건만 승인되고 1건은 차단되었습니다."
        : `이중 차감 오류 발생: 성공 건수 ${successes}건`,
      evidence: { r1, r2, successes },
    });
    console.log(`[1] 동시 2건 테스트: ${passed ? "PASS" : "FAIL"}`);

    // 정리
    DB.setUsers(DB.getUsers().filter((x) => x.id !== userId));
  }

  // -------------------------------------------------------------------------
  // 2. 크레딧 1회 잔여 상태 동시 요청 10건 대량 스파이크 테스트
  // -------------------------------------------------------------------------
  {
    const userId = "test_user_c10_" + Date.now();
    const u: User = {
      id: userId,
      email: "c10@test.com",
      passwordHash: "dummy",
      name: "동시성테스터10",
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
    DB.setUsers([...DB.getUsers(), u]);

    const promises = Array.from({ length: 10 }, (_, i) =>
      deductCredit(userId, 1, `job_c10_${i}_${Date.now()}`)
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r) => r.success).length;
    const fails = results.filter((r) => !r.success).length;
    const passed = successes === 1 && fails === 9;

    report.push({
      id: "CREDIT_CONCURRENCY_10",
      name: "크레딧 1회 상태 동시 10건 스파이크 요청",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "동시 10건 중 정확히 1건만 승인되고 9건은 잔여 부족으로 안전하게 차단되었습니다."
        : `동시성 오류: 성공 ${successes}건, 실패 ${fails}건`,
      evidence: { successes, fails },
    });
    console.log(`[2] 동시 10건 스파이크 테스트: ${passed ? "PASS" : "FAIL"}`);

    // 정리
    DB.setUsers(DB.getUsers().filter((x) => x.id !== userId));
  }

  // -------------------------------------------------------------------------
  // 3. 크레딧 0회 계정의 생성 요청 차단 검증
  // -------------------------------------------------------------------------
  {
    const userId = "test_user_c0_" + Date.now();
    const u: User = {
      id: userId,
      email: "c0@test.com",
      passwordHash: "dummy",
      name: "크레딧0테스터",
      role: "user",
      status: "active",
      membershipTier: "free",
      monthlyLimit: 3,
      usedCredits: 3, // 모두 소진
      bonusCredits: 0,
      nextResetDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    DB.setUsers([...DB.getUsers(), u]);

    const check = checkUserCredits(userId);
    const deduct = await deductCredit(userId, 1, "job_c0_attempt");
    const passed = !check.allowed && !deduct.success;

    report.push({
      id: "CREDIT_ZERO_BLOCK",
      name: "크레딧 0회 잔액 차단",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "잔여 크레딧 0회 상태에서 사전 검사 및 차감 시도가 모두 정상 거부되었습니다."
        : "잔액 부족임에도 차감 시도가 허용됨",
      evidence: { check, deduct },
    });
    console.log(`[3] 크레딧 0회 차단 테스트: ${passed ? "PASS" : "FAIL"}`);

    DB.setUsers(DB.getUsers().filter((x) => x.id !== userId));
  }

  // -------------------------------------------------------------------------
  // 4. 동일 작업 ID (jobId) 멱등성 및 중복 차감 방지 테스트
  // -------------------------------------------------------------------------
  {
    const userId = "test_user_idem_" + Date.now();
    const u: User = {
      id: userId,
      email: "idem@test.com",
      passwordHash: "dummy",
      name: "멱등성테스터",
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
    DB.setUsers([...DB.getUsers(), u]);

    const jobId = "job_unique_idem_100";
    // 첫 번째 호출
    const firstCall = await deductCredit(userId, 1, jobId);
    // 동일 jobId로 네트워크 재전송 시뮬레이션
    const secondCall = await deductCredit(userId, 1, jobId);

    const checkUser = DB.getUsers().find((x) => x.id === userId);
    // usedCredits는 2가 아니라 1이어야 함!
    const passed = firstCall.success && secondCall.success && checkUser?.usedCredits === 1;

    report.push({
      id: "IDEMPOTENT_DEDUCT",
      name: "동일 작업 ID(jobId) 중복 차감 방지 (멱등성)",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? "동일한 jobId로 2회 요청이 인입되어도 크레딧은 정확히 1회만 차감되었습니다."
        : `중복 차감 발생: 최종 usedCredits=${checkUser?.usedCredits}`,
      evidence: { firstCall, secondCall, usedCredits: checkUser?.usedCredits },
    });
    console.log(`[4] 멱등성 중복 차감 방지 테스트: ${passed ? "PASS" : "FAIL"}`);

    // -----------------------------------------------------------------------
    // 5. 중복 환불 방지 (Idempotent Refund) 테스트
    // -----------------------------------------------------------------------
    const firstRefund = await refundCredit(userId, 1, "실패1", jobId);
    const secondRefund = await refundCredit(userId, 1, "실패2", jobId);

    const finalUser = DB.getUsers().find((x) => x.id === userId);
    // usedCredits가 0 이하로 내려가거나 보너스가 늘어나면 안 됨 (0회로 원복되어야 함)
    const refundPassed = firstRefund.success && secondRefund.success && finalUser?.usedCredits === 0;

    report.push({
      id: "IDEMPOTENT_REFUND",
      name: "동일 작업 ID(jobId) 중복 환불 방지",
      status: refundPassed ? "PASS" : "FAIL",
      details: refundPassed
        ? "동일한 jobId에 대해 2회 환불을 호출하여도 중복 환불되지 않고 안전하게 원복되었습니다."
        : `중복 환불 오류 발생: 최종 usedCredits=${finalUser?.usedCredits}`,
      evidence: { firstRefund, secondRefund, usedCredits: finalUser?.usedCredits },
    });
    console.log(`[5] 멱등성 중복 환불 방지 테스트: ${refundPassed ? "PASS" : "FAIL"}`);

    DB.setUsers(DB.getUsers().filter((x) => x.id !== userId));
  }

  // -------------------------------------------------------------------------
  // 6. 로그인 Rate Limiter (Brute-Force 방어) 테스트
  // -------------------------------------------------------------------------
  {
    const targetEmail = "brute_force_victim@test.com";
    resetLoginAttempts(targetEmail);

    // 5회 연속 실패 기록
    for (let i = 0; i < 5; i++) {
      recordFailedLogin(targetEmail);
    }

    const checkBlocked = checkLoginRateLimit(targetEmail);
    const passed = !checkBlocked.allowed && (checkBlocked.remainingSeconds ?? 0) > 0;

    report.push({
      id: "AUTH_BRUTE_FORCE_DEFENSE",
      name: "로그인 5회 연속 실패 시 15분 차단 (Rate Limiter)",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? `5회 실패 후 정상 차단됨 (남은 차단 시간: ${checkBlocked.remainingSeconds}초)`
        : "5회 실패 후에도 차단되지 않음",
      evidence: checkBlocked,
    });
    console.log(`[6] 무차별 대입 공격 차단 테스트: ${passed ? "PASS" : "FAIL"}`);
    resetLoginAttempts(targetEmail);
  }

  // -------------------------------------------------------------------------
  // 7. 데이터베이스 백업 생성, SHA-256 무결성 검증, 복원 테스트
  // -------------------------------------------------------------------------
  {
    const backupMeta = createBackup();
    const verifyResult = verifyBackup(backupMeta.id);
    const restoreResult = restoreBackup(backupMeta.id);

    const passed = backupMeta.totalFiles > 0 && verifyResult.valid && restoreResult.success;

    report.push({
      id: "BACKUP_INTEGRITY_RESTORE",
      name: "SHA-256 무결성 백업 생성 및 복원",
      status: passed ? "PASS" : "FAIL",
      details: passed
        ? `백업 생성(${backupMeta.id}, 파일 ${backupMeta.totalFiles}개), SHA-256 체크섬 일치, 복원 성공`
        : `백업/복원 실패: ${verifyResult.errors.join(", ") || restoreResult.error}`,
      evidence: { backupId: backupMeta.id, verifyResult, restoreResult },
    });
    console.log(`[7] 백업 무결성 및 복원 테스트: ${passed ? "PASS" : "FAIL"}`);
  }

  // -------------------------------------------------------------------------
  // 결과 저장
  // -------------------------------------------------------------------------
  const outPath = path.join(process.cwd(), "public", "outputs", "test_verification", "readiness_test_results.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n============================================================");
  console.log(`전체 테스트 완료! 결과 리포트 저장: ${outPath}`);
  console.log("============================================================");
}

runAllTests().catch((e) => console.error(e));

