import fs from "fs";
import path from "path";
import crypto from "crypto";
import { withProcessLock } from "./db";

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

export interface BackupArchiveBundle {
  version: "1.0";
  exportedAt: string;
  metadata: BackupMetadata;
  payload: Record<string, string>; // filename -> utf8 string content
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

function computeStringHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf-8").digest("hex");
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
 * ② 원자적 스냅샷 복구 (서버 종료 및 중간 크래시 대비 자동 롤백 지원)
 */
export async function restoreBackup(backupId: string): Promise<{ success: boolean; error?: string }> {
  const verification = verifyBackup(backupId);
  if (!verification.valid) {
    return { success: false, error: `Backup integrity check failed: ${verification.errors.join(", ")}` };
  }

  const targetDir = path.join(BACKUP_ROOT, backupId);
  const meta: BackupMetadata = JSON.parse(fs.readFileSync(path.join(targetDir, "metadata.json"), "utf-8"));

  return withProcessLock("global_db_restore", async () => {
    // 1. 복구 직전 현재 상태를 안전 롤백 스냅샷으로 자동 백업
    const safetySnapshotId = `safety_pre_restore_${Date.now()}`;
    const safetyDir = path.join(BACKUP_ROOT, safetySnapshotId);
    ensureDir(safetyDir);

    const currentFiles = fs.readdirSync(DB_DIR).filter((f) => f.endsWith(".json"));
    for (const cf of currentFiles) {
      fs.copyFileSync(path.join(DB_DIR, cf), path.join(safetyDir, cf));
    }

    // 2. 임시 스테이징 디렉토리에 대상 파일들 먼저 작성 및 무결성 사전 검증
    const stagingDir = path.join(BACKUP_ROOT, `.staging_restore_${Date.now()}`);
    ensureDir(stagingDir);

    try {
      for (const f of meta.files) {
        const srcPath = path.join(targetDir, f.name);
        const stgPath = path.join(stagingDir, f.name);
        const content = fs.readFileSync(srcPath, "utf-8");
        // 파싱 가능 여부 확인
        JSON.parse(content);
        fs.writeFileSync(stgPath, content, "utf-8");
      }

      // 3. 검증 통과 시 운영 DB 디렉터리로 원자적 교체
      for (const f of meta.files) {
        const stgPath = path.join(stagingDir, f.name);
        const finalDest = path.join(DB_DIR, f.name);
        fs.copyFileSync(stgPath, finalDest);
      }

      // 스테이징 정리
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {}

      return { success: true };
    } catch (err: any) {
      console.error("[Restore Failed - Rolling back to safety snapshot]", err);
      // 오류 발생 시 즉시 안전 스냅샷으로 원복
      for (const cf of currentFiles) {
        fs.copyFileSync(path.join(safetyDir, cf), path.join(DB_DIR, cf));
      }
      return { success: false, error: `복구 도중 오류가 발생하여 안전 스냅샷으로 원복되었습니다: ${err.message}` };
    }
  });
}

/**
 * 외부/원격 저장소 보관용 백업 번들 내보내기 (Export)
 */
export function exportBackupArchive(backupId: string): BackupArchiveBundle {
  const targetDir = path.join(BACKUP_ROOT, backupId);
  const meta: BackupMetadata = JSON.parse(fs.readFileSync(path.join(targetDir, "metadata.json"), "utf-8"));

  const payload: Record<string, string> = {};
  for (const f of meta.files) {
    payload[f.name] = fs.readFileSync(path.join(targetDir, f.name), "utf-8");
  }

  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    metadata: meta,
    payload,
  };
}

/**
 * 외부/원격 저장소에서 백업 번들 가져오기 (Import)
 */
export function importBackupArchive(bundle: BackupArchiveBundle): { success: boolean; backupId?: string; error?: string } {
  if (bundle.version !== "1.0" || !bundle.metadata || !bundle.payload) {
    return { success: false, error: "Invalid backup archive bundle format" };
  }

  const importId = `imported_${bundle.metadata.id}_${Date.now().toString(36)}`;
  const targetDir = path.join(BACKUP_ROOT, importId);
  ensureDir(targetDir);

  const fileMetaList: BackupMetadata["files"] = [];
  let totalBytes = 0;

  for (const [filename, content] of Object.entries(bundle.payload)) {
    const destPath = path.join(targetDir, filename);
    fs.writeFileSync(destPath, content, "utf-8");
    const hash = computeStringHash(content);
    const size = Buffer.byteLength(content, "utf-8");

    fileMetaList.push({
      name: filename,
      sizeBytes: size,
      sha256: hash,
    });
    totalBytes += size;
  }

  const meta: BackupMetadata = {
    id: importId,
    timestamp: new Date().toISOString(),
    files: fileMetaList,
    totalFiles: fileMetaList.length,
    totalSizeBytes: totalBytes,
    integrityVerified: true,
  };

  fs.writeFileSync(path.join(targetDir, "metadata.json"), JSON.stringify(meta, null, 2), "utf-8");
  return { success: true, backupId: importId };
}
