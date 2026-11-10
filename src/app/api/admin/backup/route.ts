import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  createBackup,
  listBackups,
  verifyBackup,
  restoreBackup,
  exportBackupArchive,
  importBackupArchive,
} from "@/lib/backup";
import { DB } from "@/lib/db";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const backups = listBackups();
  return NextResponse.json({ backups });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { action, backupId, archiveBundle } = body;

  if (action === "create") {
    const meta = createBackup();
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "BACKUP_CREATE",
      details: { backupId: meta.id, filesCount: meta.totalFiles, sizeBytes: meta.totalSizeBytes },
    });
    return NextResponse.json({ success: true, backup: meta });
  }

  if (action === "verify" && backupId) {
    const result = verifyBackup(backupId);
    return NextResponse.json({ success: true, verification: result });
  }

  if (action === "restore" && backupId) {
    const result = await restoreBackup(backupId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "복원 실패" }, { status: 400 });
    }
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "BACKUP_RESTORE",
      details: { backupId },
    });
    return NextResponse.json({ success: true, message: "백업 복원이 완료되었습니다." });
  }

  // 외부 보관용 내보내기 (Export)
  if (action === "export" && backupId) {
    try {
      const bundle = exportBackupArchive(backupId);
      return NextResponse.json({ success: true, bundle });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "내보내기 실패" }, { status: 400 });
    }
  }

  // 외부 백업본 반입 (Import)
  if (action === "import" && archiveBundle) {
    const importResult = importBackupArchive(archiveBundle);
    if (!importResult.success) {
      return NextResponse.json({ error: importResult.error || "가져오기 실패" }, { status: 400 });
    }
    DB.addLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "BACKUP_IMPORT",
      details: { backupId: importResult.backupId },
    });
    return NextResponse.json({ success: true, backupId: importResult.backupId });
  }

  return NextResponse.json({ error: "올바르지 않은 action입니다." }, { status: 400 });
}
