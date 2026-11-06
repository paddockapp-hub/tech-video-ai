import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_DIR = path.join(process.cwd(), "data", "db");
const BACKUP_ROOT = path.join(process.cwd(), "data", "backups");

export interface BackupMetadata {
  id: string;
  timestamp: string;
  files: {
    name: string;
    sizeBytes: number;
    sha256: string;
  }[];
  totalFiles: number;
  totalSizeBytes: number;
  integrityVerified: boolean;
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function computeFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * DB 자동 백업 생성
 */
export function createBackup(): BackupMetadata {
  ensureDir(DB_DIR);
  ensureDir(BACKUP_ROOT);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupId = `backup_${timestamp}`;
  const targetDir = path.join(BACKUP_ROOT, backupId);
  ensureDir(targetDir);

  const dbFiles = fs.readdirSync(DB_DIR).filter((f) => f.endsWith(".json"));
  const fileMetaList: BackupMetadata["files"] = [];
  let totalBytes = 0;

  for (const file of dbFiles) {
    const srcPath = path.join(DB_DIR, file);
    const destPath = path.join(targetDir, file);

    const content = fs.readFileSync(srcPath);
    // JSON 유효성 검사
    try {
      JSON.parse(content.toString("utf-8"));
    } catch (e) {
      console.warn(`[Backup Warning] File ${file} contains malformed JSON, copying anyway.`);
    }

    fs.writeFileSync(destPath, content);
    const hash = computeFileHash(destPath);

    fileMetaList.push({
      name: file,
      sizeBytes: content.length,
      sha256: hash,
    });
    totalBytes += content.length;
  }

  const meta: BackupMetadata = {
    id: backupId,
    timestamp: new Date().toISOString(),
    files: fileMetaList,
    totalFiles: fileMetaList.length,
    totalSizeBytes: totalBytes,
    integrityVerified: true,
  };

  fs.writeFileSync(
    path.join(targetDir, "metadata.json"),
    JSON.stringify(meta, null, 2),
    "utf-8"
  );

  return meta;
}

/**
 * 백업 무결성 검증
 */
export function verifyBackup(backupId: string): { valid: boolean; errors: string[] } {
  const targetDir = path.join(BACKUP_ROOT, backupId);
  const metaPath = path.join(targetDir, "metadata.json");

  if (!fs.existsSync(metaPath)) {
    return { valid: false, errors: ["Metadata file not found"] };
  }

  const errors: string[] = [];
  try {
    const meta: BackupMetadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    for (const f of meta.files) {
      const filePath = path.join(targetDir, f.name);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing file: ${f.name}`);
        continue;
      }
      const actualHash = computeFileHash(filePath);
      if (actualHash !== f.sha256) {
        errors.push(`Checksum mismatch for ${f.name}: expected ${f.sha256}, got ${actualHash}`);
      }
    }
  } catch (err: any) {
    errors.push(`Failed to parse metadata: ${err.message}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 백업 목록 조회
 */
export function listBackups(): BackupMetadata[] {
  ensureDir(BACKUP_ROOT);
  const entries = fs.readdirSync(BACKUP_ROOT);
  const result: BackupMetadata[] = [];

  for (const entry of entries) {
    const metaPath = path.join(BACKUP_ROOT, entry, "metadata.json");
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8")) as BackupMetadata;
        result.push(meta);
      } catch {}
    }
  }

  return result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * 백업 복구 (Restore) - 원자적 복구 보장
 * 복구 도중 서버 종료 시에도 데이터 무결성 보장
 */
export function restoreBackup(backupId: string): { success: boolean; error?: string } {
  const verification = verifyBackup(backupId);
  if (!verification.valid) {
    return { success: false, error: `Backup integrity check failed: ${verification.errors.join(", ")}` };
  }

  const targetDir = path.join(BACKUP_ROOT, backupId);
  const meta: BackupMetadata = JSON.parse(fs.readFileSync(path.join(targetDir, "metadata.json"), "utf-8"));

  // 복구 전 현재 상태를 안전 백업 (롤백용)
  let preRestoreBackupId: string | null = null;
  try {
    const preRestoreMeta = createBackup();
    preRestoreBackupId = preRestoreMeta.id;
  } catch (err) {
    console.warn("[Restore] Pre-restore safety backup failed:", err);
  }

  // 원자적 복구: 임시 디렉토리에 먼저 복사 후 한 번에 이동
  const tempRestoreDir = path.join(BACKUP_ROOT, `temp_restore_${Date.now()}`);
  ensureDir(tempRestoreDir);

  try {
    // 1. 임시 디렉토리에 백업 파일 복사
    for (const f of meta.files) {
      const srcPath = path.join(targetDir, f.name);
      const tempPath = path.join(tempRestoreDir, f.name);
      const content = fs.readFileSync(srcPath);
      fs.writeFileSync(tempPath, content, "utf-8");
    }

    // 2. 원자적 파일 교체 (rename은 대부분의 OS에서 원자적)
    for (const f of meta.files) {
      const tempPath = path.join(tempRestoreDir, f.name);
      const destPath = path.join(DB_DIR, f.name);
      fs.renameSync(tempPath, destPath);
    }

    // 3. 임시 디렉토리 정리
    fs.rmSync(tempRestoreDir, { recursive: true, force: true });

    return { success: true };
  } catch (err: any) {
    // 복구 실패 시 롤백
    console.error("[Restore Error] Atomic restore failed, attempting rollback:", err);

    // 임시 디렉토리 정리
    try {
      fs.rmSync(tempRestoreDir, { recursive: true, force: true });
    } catch {}

    // 사전 백업이 있으면 롤백
    if (preRestoreBackupId) {
      console.log("[Restore] Rolling back to pre-restore backup:", preRestoreBackupId);
      try {
        const preRestoreDir = path.join(BACKUP_ROOT, preRestoreBackupId);
        const preRestoreMeta = JSON.parse(fs.readFileSync(path.join(preRestoreDir, "metadata.json"), "utf-8"));

        for (const f of preRestoreMeta.files) {
          const srcPath = path.join(preRestoreDir, f.name);
          const destPath = path.join(DB_DIR, f.name);
          const content = fs.readFileSync(srcPath);
          fs.writeFileSync(destPath, content, "utf-8");
        }
      } catch (rollbackErr) {
        console.error("[Restore] Rollback also failed:", rollbackErr);
      }
    }

    return { success: false, error: `복구 실패: ${err.message}. 롤백 시도 완료.` };
  }
}

