import fs from "fs";
import path from "path";

export type Role = "user" | "admin";
export type MembershipTier = "free" | "basic" | "standard" | "premium";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
  membershipTier: MembershipTier;
  monthlyLimit: number;
  usedCredits: number;
  bonusCredits: number;
  nextResetDate: string; // ISO date
  membershipExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus =
  | "pending_deposit"
  | "verifying"
  | "completed"
  | "rejected"
  | "canceled"
  | "refunded";

export interface BankTransferRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  tier: MembershipTier;
  amountKRW: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  depositCode: string; // e.g. SM-A89F4K
  depositorName: string;
  status: PaymentStatus;
  userMemo?: string;
  adminMemo?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}

export interface SystemConfig {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNotice: string;
  allowAutoBankTransfer: boolean;
  tierLimits: Record<MembershipTier, number>;
  tierPricesKRW: Record<MembershipTier, number>;
  creditPackages: Array<{
    id: string;
    name: string;
    credits: number;
    priceKRW: number;
    discountPercent?: number;
  }>;
  updatedAt: string;
}

export interface AdminLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId?: string;
  details: Record<string, any>;
  ip?: string;
  createdAt: string;
}

export interface VideoGenerationLog {
  id: string;
  userId: string;
  title: string;
  category: string;
  subcategory: string;
  durationSec: number;
  creditCost: number;
  status: "success" | "failed";
  error?: string;
  costEstimatedKRW: number;
  createdAt: string;
}

export interface CreditPurchase {
  id: string;
  userId: string;
  packageId: string;
  credits: number;
  priceKRW: number;
  paymentMethod: "toss" | "gpt" | "card";
  status: "pending" | "completed" | "failed";
  createdAt: string;
  completedAt?: string;
  tossTransferId?: string;
  gptTransactionId?: string;
}

export interface OpenAIIntegration {
  userId: string;
  apiKey: string;
  balanceCredits: number;
  linkedAt: string;
  lastUsedAt: string;
}

// Vercel / AWS Lambda 등 서버리스 환경(Read-only root) 지원
const isServerless = process.env.VERCEL === "1" || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const SOURCE_DB_DIR = path.join(process.cwd(), "data", "db");

export const DB_DIR = isServerless
  ? path.join("/tmp", "shortsmaking_data", "db")
  : path.join(process.cwd(), "data", "db");

export const LOCK_DIR = isServerless
  ? path.join("/tmp", "shortsmaking_data", "locks")
  : path.join(process.cwd(), "data", "locks");

export const BACKUP_DIR = isServerless
  ? path.join("/tmp", "shortsmaking_data", "backups")
  : path.join(process.cwd(), "data", "backups");

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOCK_DIR)) {
    fs.mkdirSync(LOCK_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 서버리스 환경일 경우 프로젝트에 번들된 초기 시드 JSON 파일들을 /tmp로 초기 복사
  if (isServerless && fs.existsSync(SOURCE_DB_DIR)) {
    try {
      const files = fs.readdirSync(SOURCE_DB_DIR);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const dest = path.join(DB_DIR, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(path.join(SOURCE_DB_DIR, file), dest);
          }
        }
      }
    } catch (e) {
      console.warn("[Serverless Seed Copy Warning]", e);
    }
  }
}

// ---------------------------------------------------------------------------
// OS 파일 시스템 기반 프로세스 간 파일 락 (Lockfile with retry & timeout)
// O_CREAT | O_EXCL 플래그로 원자적 잠금 보장 - 여러 Node.js 프로세스 간에도 안전
// 단일 프로세스뿐만 아니라 PM2/Cluster 등 멀티 프로세스 환경에서도 유효
// ---------------------------------------------------------------------------
const LOCK_STALE_MS = 10000; // 10초 지난 죽은 락은 자동 해제
const LOCK_RETRY_INTERVAL_MS = 25;
const LOCK_MAX_WAIT_MS = 6000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withProcessLock<T>(resourceName: string, fn: () => Promise<T> | T): Promise<T> {
  ensureDbDir();
  const lockFilePath = path.join(LOCK_DIR, `${resourceName}.lock`);
  const startTime = Date.now();

  while (true) {
    try {
      // O_CREAT | O_EXCL로 원자적 잠금 시도
      const fd = fs.openSync(lockFilePath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR);
      fs.writeSync(fd, `${process.pid}\n${Date.now()}`);
      fs.closeSync(fd);
      break; // 잠금 획득 성공
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // 이미 락이 걸려있는 경우, 죽은 락인지 확인
        try {
          const stats = fs.statSync(lockFilePath);
          if (Date.now() - stats.mtimeMs > LOCK_STALE_MS) {
            try {
              fs.unlinkSync(lockFilePath);
              continue;
            } catch {}
          }
        } catch {}

        if (Date.now() - startTime > LOCK_MAX_WAIT_MS) {
          throw new Error(`[Lock Timeout] Failed to acquire lock for ${resourceName} within ${LOCK_MAX_WAIT_MS}ms`);
        }
        await sleep(LOCK_RETRY_INTERVAL_MS);
      } else {
        throw err;
      }
    }
  }

  try {
    return await fn();
  } finally {
    try {
      if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
      }
    } catch (e) {
      console.warn(`[Lock Release Warning] Could not release lock ${lockFilePath}:`, e);
    }
  }
}

// ---------------------------------------------------------------------------
// 백업 시스템 (운영 데이터와 분리된 저장소 보관)
// ---------------------------------------------------------------------------
function createBackup(filename: string): void {
  ensureDbDir();
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const backupPath = path.join(BACKUP_DIR, `${filename}.${timestamp}.bak`);

  try {
    fs.copyFileSync(filePath, backupPath);
    console.log(`[Backup] Created: ${backupPath}`);
  } catch (err) {
    console.error(`[Backup Error] Failed to backup ${filename}:`, err);
  }
}

function restoreFromBackup(filename: string, timestamp?: string): boolean {
  ensureDbDir();
  const filePath = path.join(DB_DIR, filename);

  if (timestamp) {
    const backupPath = path.join(BACKUP_DIR, `${filename}.${timestamp}.bak`);
    if (!fs.existsSync(backupPath)) {
      console.error(`[Restore Error] Backup not found: ${backupPath}`);
      return false;
    }
    try {
      fs.copyFileSync(backupPath, filePath);
      console.log(`[Restore] Restored from: ${backupPath}`);
      return true;
    } catch (err) {
      console.error(`[Restore Error] Failed to restore ${filename}:`, err);
      return false;
    }
  } else {
    // 최신 백업 찾기
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(filename) && f.endsWith('.bak'))
      .sort()
      .reverse();

    if (backups.length === 0) {
      console.error(`[Restore Error] No backups found for ${filename}`);
      return false;
    }

    const latestBackup = backups[0];
    const backupPath = path.join(BACKUP_DIR, latestBackup);
    try {
      fs.copyFileSync(backupPath, filePath);
      console.log(`[Restore] Restored from latest: ${backupPath}`);
      return true;
    } catch (err) {
      console.error(`[Restore Error] Failed to restore ${filename}:`, err);
      return false;
    }
  }
}

function cleanOldBackups(filename: string, keepDays: number = 7): void {
  ensureDbDir();
  const now = Date.now();
  const maxAge = keepDays * 24 * 60 * 60 * 1000;

  try {
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(filename) && f.endsWith('.bak'));

    backups.forEach(backup => {
      const backupPath = path.join(BACKUP_DIR, backup);
      const stats = fs.statSync(backupPath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(backupPath);
        console.log(`[Backup Cleanup] Deleted old backup: ${backup}`);
      }
    });
  } catch (err) {
    console.error(`[Backup Cleanup Error] Failed to clean old backups:`, err);
  }
}

// ---------------------------------------------------------------------------
// 안전한 원자적 JSON 입출력
// ---------------------------------------------------------------------------
function readJson<T>(filename: string, fallback: T): T {
  ensureDbDir();
  const filePath = path.join(DB_DIR, filename);
  if (!fs.existsSync(filePath)) {
    writeAtomicJson(filename, fallback);
    return fallback;
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[DB read error] ${filename}:`, err);
    return fallback;
  }
}

function writeAtomicJson<T>(filename: string, data: T): void {
  ensureDbDir();
  const filePath = path.join(DB_DIR, filename);
  const tempPath = path.join(DB_DIR, `${filename}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`);
  const content = JSON.stringify(data, null, 2);

  // 쓰기 전 백업 생성 (서버 종료 중 데이터 손실 방지)
  if (fs.existsSync(filePath)) {
    createBackup(filename);
  }

  try {
    const fd = fs.openSync(tempPath, "w");
    fs.writeFileSync(fd, content, "utf-8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
    fs.writeFileSync(filePath, content, "utf-8");
  }

  // 오래된 백업 정리 (7일 보관)
  cleanOldBackups(filename, 7);
}

// ---------------------------------------------------------------------------
// 통합 DB 리포지토리 및 다중 파일 원자적 트랜잭션
// ---------------------------------------------------------------------------
export const DB = {
  getUsers: (): User[] => readJson<User[]>("users.json", []),
  setUsers: (users: User[]): void => writeAtomicJson("users.json", users),

  getTransfers: (): BankTransferRequest[] =>
    readJson<BankTransferRequest[]>("transfers.json", []),
  setTransfers: (transfers: BankTransferRequest[]): void =>
    writeAtomicJson("transfers.json", transfers),

  getConfig: (): SystemConfig =>
    readJson<SystemConfig>("config.json", {
      bankName: "토스뱅크",
      accountNumber: "1000-1234-5678",
      accountHolder: "주식회사 쇼츠메이킹",
      transferNotice:
        "입금자명 뒤에 고유 입금 코드를 함께 적어주시면 빠른 확인이 가능합니다. (예: 홍길동SM9F)",
      allowAutoBankTransfer: true,
      tierLimits: {
        free: 3,
        basic: 30,
        standard: 100,
        premium: 150,
      },
      tierPricesKRW: {
        free: 0,
        basic: 29000,
        standard: 44900,
        premium: 79000,
      },
      creditPackages: [
        {
          id: "pkg_10_3500",
          name: "10회 패키지",
          credits: 10,
          priceKRW: 3500,
          discountPercent: 0,
        },
        {
          id: "pkg_30_10000",
          name: "30회 패키지",
          credits: 30,
          priceKRW: 10000,
          discountPercent: 5,
        },
        {
          id: "pkg_100_30000",
          name: "100회 패키지",
          credits: 100,
          priceKRW: 30000,
          discountPercent: 14,
        },
      ],
      updatedAt: new Date().toISOString(),
    }),
  setConfig: (config: SystemConfig): void => writeAtomicJson("config.json", config),

  getLogs: (): AdminLog[] => readJson<AdminLog[]>("admin_logs.json", []),
  addLog: (log: Omit<AdminLog, "id" | "createdAt">): AdminLog => {
    const logs = DB.getLogs();
    const entry: AdminLog = {
      ...log,
      id: "log_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
    };
    logs.unshift(entry);
    writeAtomicJson("admin_logs.json", logs.slice(0, 1000));
    return entry;
  },

  getVideoLogs: (): VideoGenerationLog[] =>
    readJson<VideoGenerationLog[]>("video_logs.json", []),
  addVideoLog: (
    vLog: Omit<VideoGenerationLog, "id" | "createdAt">
  ): VideoGenerationLog => {
    const list = DB.getVideoLogs();
    const entry: VideoGenerationLog = {
      ...vLog,
      id: "vlog_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    writeAtomicJson("video_logs.json", list.slice(0, 2000));
    return entry;
  },

  getCreditPurchases: (): CreditPurchase[] =>
    readJson<CreditPurchase[]>("credit_purchases.json", []),
  setCreditPurchases: (purchases: CreditPurchase[]): void =>
    writeAtomicJson("credit_purchases.json", purchases),
  addCreditPurchase: (
    purchase: Omit<CreditPurchase, "id" | "createdAt">
  ): CreditPurchase => {
    const list = DB.getCreditPurchases();
    const entry: CreditPurchase = {
      ...purchase,
      id: "cp_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
      createdAt: new Date().toISOString(),
    };
    list.unshift(entry);
    writeAtomicJson("credit_purchases.json", list.slice(0, 1000));
    return entry;
  },

  getOpenAIIntegrations: (): OpenAIIntegration[] =>
    readJson<OpenAIIntegration[]>("openai_integrations.json", []),
  setOpenAIIntegrations: (integrations: OpenAIIntegration[]): void =>
    writeAtomicJson("openai_integrations.json", integrations),
  addOpenAIIntegration: (
    integration: Omit<OpenAIIntegration, "linkedAt" | "lastUsedAt">
  ): OpenAIIntegration => {
    const list = DB.getOpenAIIntegrations();
    const entry: OpenAIIntegration = {
      ...integration,
      linkedAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    const existingIdx = list.findIndex((i) => i.userId === integration.userId);
    if (existingIdx !== -1) {
      list[existingIdx] = entry;
    } else {
      list.push(entry);
    }
    writeAtomicJson("openai_integrations.json", list);
    return entry;
  },

  updateUsersAtomic: async <T>(updater: (users: User[]) => { users: User[]; result: T }): Promise<T> => {
    return withProcessLock("users", () => {
      const users = DB.getUsers();
      const { users: updated, result } = updater(users);
      DB.setUsers(updated);
      return result;
    });
  },

  updateTransfersAtomic: async <T>(updater: (transfers: BankTransferRequest[]) => { transfers: BankTransferRequest[]; result: T }): Promise<T> => {
    return withProcessLock("transfers", () => {
      const transfers = DB.getTransfers();
      const { transfers: updated, result } = updater(transfers);
      DB.setTransfers(updated);
      return result;
    });
  },

  /**
   * ⑤ 결제 승인 원자적 단일 트랜잭션 (All-or-Nothing 롤백 보장)
   * transfers.json과 users.json을 임시 디렉토리에 동시에 쓴 후 한 번에 rename하여
   * 서버 종료 중에도 데이터 불일치 방지
   */
  executePaymentApprovalTransaction: async (
    transferId: string,
    action: "approve" | "reject" | "refund",
    adminMemo?: string
  ): Promise<{
    success: boolean;
    error?: string;
    statusCode?: number;
    transfer?: BankTransferRequest;
    user?: User;
  }> => {
    return withProcessLock("global_payment_tx", async () => {
      // 1. 기존 데이터 스냅샷 저장 (롤백용)
      const usersSnapshot = DB.getUsers();
      const transfersSnapshot = DB.getTransfers();

      try {
        const transfers = [...transfersSnapshot];
        const tIdx = transfers.findIndex((t) => t.id === transferId);
        if (tIdx === -1) {
          return { success: false, error: "해당 입금 내역을 찾을 수 없습니다.", statusCode: 404 };
        }

        const transfer = { ...transfers[tIdx] };

        // 멱등성 가드: 이미 승인 완료된 경우 재승인 차단
        if (action === "approve" && transfer.status === "completed") {
          return { success: false, error: "이미 승인 완료된 신청 내역입니다.", statusCode: 400 };
        }
        if (action === "reject" && transfer.status === "completed") {
          return { success: false, error: "이미 승인 완료된 멤버십은 반려할 수 없습니다.", statusCode: 400 };
        }

        const users = [...usersSnapshot];
        const uIdx = users.findIndex((u) => u.id === transfer.userId);
        if (uIdx === -1) {
          return { success: false, error: "해당 신청의 유저 정보를 찾을 수 없습니다.", statusCode: 404 };
        }
        const user = { ...users[uIdx] };
        const config = DB.getConfig();

        if (action === "approve") {
          transfer.status = "completed";
          transfer.approvedAt = new Date().toISOString();
          transfer.adminMemo = adminMemo || "입금 확인 완료 - 멤버십 활성화";
          transfer.updatedAt = new Date().toISOString();

          user.membershipTier = transfer.tier;
          user.monthlyLimit = config.tierLimits[transfer.tier] ?? 30;
          user.usedCredits = 0; // 신규 활성화 시 사용량 0으로 리셋

          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          user.membershipExpiresAt = expires.toISOString();
          user.nextResetDate = expires.toISOString();
          user.updatedAt = new Date().toISOString();
        } else if (action === "reject") {
          transfer.status = "rejected";
          transfer.adminMemo = adminMemo || "입금 내역 불일치로 반려";
          transfer.updatedAt = new Date().toISOString();
        } else if (action === "refund") {
          transfer.status = "refunded";
          transfer.adminMemo = adminMemo || "환불 처리 완료";
          transfer.updatedAt = new Date().toISOString();

          user.membershipTier = "free";
          user.monthlyLimit = config.tierLimits.free ?? 3;
          user.membershipExpiresAt = undefined;
          user.updatedAt = new Date().toISOString();
        }

        transfers[tIdx] = transfer;
        users[uIdx] = user;

        // 원자적 동시 저장: 임시 디렉토리에 쓴 후 한 번에 rename
        const tempTxDir = path.join(DB_DIR, `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        fs.mkdirSync(tempTxDir, { recursive: true });

        try {
          // 임시 디렉토리에 두 파일 쓰기
          const tempUsersPath = path.join(tempTxDir, "users.json");
          const tempTransfersPath = path.join(tempTxDir, "transfers.json");

          fs.writeFileSync(tempUsersPath, JSON.stringify(users, null, 2), "utf-8");
          fs.writeFileSync(tempTransfersPath, JSON.stringify(transfers, null, 2), "utf-8");

          // 원자적 파일 교체 (rename은 대부분의 OS에서 원자적)
          const usersPath = path.join(DB_DIR, "users.json");
          const transfersPath = path.join(DB_DIR, "transfers.json");

          fs.renameSync(tempUsersPath, usersPath);
          fs.renameSync(tempTransfersPath, transfersPath);

          // 임시 디렉토리 정리
          fs.rmSync(tempTxDir, { recursive: true, force: true });
        } catch (writeErr: any) {
          // 쓰기 실패 시 임시 디렉토리 정리
          try {
            fs.rmSync(tempTxDir, { recursive: true, force: true });
          } catch {}
          throw writeErr;
        }

        return { success: true, transfer, user };
      } catch (err: any) {
        // 중간 에러 발생 시 원본 스냅샷으로 롤백
        console.error("[Payment Transaction Failed - Rolling back]", err);
        DB.setUsers(usersSnapshot);
        DB.setTransfers(transfersSnapshot);
        return { success: false, error: "트랜잭션 처리 중 오류가 발생하여 롤백되었습니다.", statusCode: 500 };
      }
    });
  },
};
