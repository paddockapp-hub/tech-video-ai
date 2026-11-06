"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  Shield,
  Users,
  CreditCard,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  DollarSign,
  Video,
  Activity,
  Save,
  RefreshCw,
  HardDrive,
  Download,
  RotateCcw,
} from "lucide-react";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<"stats" | "transfers" | "users" | "config" | "backups">("stats");
  const [stats, setStats] = useState<any>(null);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [config, setConfig] = useState<any>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsRes, transRes, usersRes, confRes, backupRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/transfers"),
        fetch("/api/admin/users"),
        fetch("/api/admin/config"),
        fetch("/api/admin/backup"),
      ]);

      if (statsRes.ok) setStats((await statsRes.json()).summary);
      if (transRes.ok) setTransfers((await transRes.json()).transfers);
      if (usersRes.ok) setUsers((await usersRes.json()).users);
      if (confRes.ok) setConfig((await confRes.json()).config);
      if (backupRes.ok) setBackups((await backupRes.json()).backups || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveTransfer(transferId: string) {
    if (!confirm("입금 내역을 확인하셨습니까? 승인 시 해당 유저의 멤버십과 생성 횟수가 즉시 부여됩니다.")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action: "approve" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("멤버십 활성화가 완료되었습니다.");
        loadAll();
      } else {
        alert(data.error || "승인 실패");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectTransfer(transferId: string) {
    const reason = prompt("반려 사유를 입력하세요 (예: 입금자명 불일치):");
    if (!reason) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId, action: "reject", adminMemo: reason }),
      });
      if (res.ok) {
        alert("신청이 반려되었습니다.");
        loadAll();
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdateUserTier(userId: string, tier: string) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "update_tier", tier }),
    });
    if (res.ok) {
      alert("회원 등급이 변경되었습니다.");
      loadAll();
    }
  }

  async function handleToggleUserStatus(userId: string, currentStatus: string) {
    const nextStatus = currentStatus === "active" ? "suspended" : "active";
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action: "toggle_status", status: nextStatus }),
    });
    if (res.ok) {
      alert(`계정이 ${nextStatus === "suspended" ? "정지" : "활성화"}되었습니다.`);
      loadAll();
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setMessage("설정이 성공적으로 저장되었습니다.");
        setTimeout(() => setMessage(""), 3000);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCreateBackup() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create" }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(`무결성 백업 생성 완료! (ID: ${data.backup.id}, 파일: ${data.backup.totalFiles}개)`);
        loadAll();
      } else {
        alert(data.error || "백업 생성 실패");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestoreBackup(backupId: string) {
    if (!confirm(`주의: ${backupId} 시점으로 데이터를 복원하시겠습니까? 현재 상태는 안전 백업본으로 저장됩니다.`)) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", backupId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("백업 복원이 성공적으로 완료되었습니다!");
        loadAll();
      } else {
        alert(data.error || "복원 실패");
      }
    } finally {
      setActionLoading(false);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
              <Shield className="h-3.5 w-3.5" />
              최고 관리자 통제 센터
            </div>
            <h1 className="mt-2 text-3xl font-extrabold text-white">관리자 대시보드</h1>
          </div>

          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition"
          >
            <RefreshCw className="h-4 w-4" />
            새로고침
          </button>
        </div>

        {/* 탭 네비게이션 */}
        <div className="mb-8 flex gap-2 border-b border-slate-800 pb-4 overflow-x-auto">
          {[
            { id: "stats", label: "운영 현황 & 원가", icon: Activity },
            { id: "transfers", label: "계좌이체 승인 대기", icon: CreditCard },
            { id: "users", label: "회원 및 크레딧 관리", icon: Users },
            { id: "config", label: "은행 및 등급 설정", icon: Settings },
            { id: "backups", label: "데이터 백업 & 복구", icon: HardDrive },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {message && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* 1. 운영 현황 & 원가 탭 */}
        {activeTab === "stats" && stats && (
          <div className="space-y-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="총 회원 수"
                value={`${stats.totalUsers}명`}
                sub={`Basic: ${stats.tierCounts.basic} / Standard: ${stats.tierCounts.standard} / Premium: ${stats.tierCounts.premium}`}
                icon={<Users className="h-5 w-5 text-indigo-400" />}
              />
              <StatCard
                title="미확인 입금 신청"
                value={`${stats.pendingTransfers}건`}
                sub="즉시 승인 필요"
                highlight={stats.pendingTransfers > 0}
                icon={<CreditCard className="h-5 w-5 text-amber-400" />}
              />
              <StatCard
                title="누적 결제 매출"
                value={`${stats.totalRevenueKRW.toLocaleString()}원`}
                sub="계좌이체 누적 실적"
                icon={<DollarSign className="h-5 w-5 text-emerald-400" />}
              />
              <StatCard
                title="영상 생성 성공률"
                value={`${stats.successRate}%`}
                sub={`총 ${stats.totalGenerations}회 중 실패 ${stats.failCount}건`}
                icon={<Video className="h-5 w-5 text-cyan-400" />}
              />
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
              <h3 className="text-base font-bold text-white mb-4">
                💰 비용 최적화 및 1편당 원가 분석 (정식 상용 인프라 기준)
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400">쇼츠 1편당 정식 원가</p>
                  <p className="text-2xl font-bold text-cyan-400 mt-1">약 12.6원</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    대본(1.8원) + 정식 Azure TTS(5.8원) + EC2(3.5원) + S3/CDN(1.5원)
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400">누적 예상 인프라 비용</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {stats.totalEstimatedCostKRW.toLocaleString()}원
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    서버 부하 및 트래픽 포함 추정치
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <p className="text-xs text-slate-400">Standard 플랜 마진율</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">98.4%</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    100편 매출 79,000원 vs 정식 원가 1,260원
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. 계좌이체 승인 대기 탭 */}
        {activeTab === "transfers" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <h3 className="text-lg font-bold text-white mb-4">
              계좌이체 신청 내역 ({transfers.length}건)
            </h3>

            {transfers.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">신청 내역이 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400">
                    <tr>
                      <th className="pb-3 pr-4">신청일시</th>
                      <th className="pb-3 pr-4">입금코드</th>
                      <th className="pb-3 pr-4">회원(이메일)</th>
                      <th className="pb-3 pr-4">신청플랜</th>
                      <th className="pb-3 pr-4">금액</th>
                      <th className="pb-3 pr-4">입금자명</th>
                      <th className="pb-3 pr-4">상태</th>
                      <th className="pb-3 text-right">관리 조치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {transfers.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-900/60">
                        <td className="py-3.5 pr-4 text-slate-400">
                          {new Date(t.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 pr-4 font-mono font-bold text-amber-400">
                          {t.depositCode}
                        </td>
                        <td className="py-3.5 pr-4 text-white font-medium">
                          {t.userName} <span className="text-slate-400">({t.userEmail})</span>
                        </td>
                        <td className="py-3.5 pr-4 uppercase font-bold text-cyan-400">
                          {t.tier}
                        </td>
                        <td className="py-3.5 pr-4 text-white font-semibold">
                          {t.amountKRW.toLocaleString()}원
                        </td>
                        <td className="py-3.5 pr-4 text-slate-300 font-medium">
                          {t.depositorName}
                        </td>
                        <td className="py-3.5 pr-4">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : t.status === "rejected"
                                  ? "bg-rose-500/10 text-rose-400"
                                  : "bg-amber-500/10 text-amber-400"
                              }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right space-x-2">
                          {t.status !== "completed" && (
                            <>
                              <button
                                onClick={() => handleApproveTransfer(t.id)}
                                disabled={actionLoading}
                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                              >
                                입금확인 및 승인
                              </button>
                              <button
                                onClick={() => handleRejectTransfer(t.id)}
                                disabled={actionLoading}
                                className="rounded-lg border border-rose-500/30 px-2.5 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition"
                              >
                                반려
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. 회원 및 크레딧 관리 탭 */}
        {activeTab === "users" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-bold text-white">회원 목록 ({users.length}명)</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="이메일 또는 이름 검색..."
                  className="rounded-xl border border-slate-700 bg-slate-800/60 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">회원명</th>
                    <th className="pb-3 pr-4">이메일</th>
                    <th className="pb-3 pr-4">역할</th>
                    <th className="pb-3 pr-4">멤버십</th>
                    <th className="pb-3 pr-4">사용량 / 한도</th>
                    <th className="pb-3 pr-4">계정상태</th>
                    <th className="pb-3 text-right">등급 변경 및 조치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-900/60">
                      <td className="py-3.5 pr-4 text-white font-medium">{u.name}</td>
                      <td className="py-3.5 pr-4 text-slate-300 font-mono">{u.email}</td>
                      <td className="py-3.5 pr-4 text-slate-400 uppercase">{u.role}</td>
                      <td className="py-3.5 pr-4 uppercase font-bold text-indigo-400">
                        {u.membershipTier}
                      </td>
                      <td className="py-3.5 pr-4 text-slate-300">
                        {u.usedCredits} / <span className="font-bold text-white">{u.monthlyLimit}회</span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${u.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-rose-500/10 text-rose-400"
                            }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right space-x-1.5">
                        <select
                          value={u.membershipTier}
                          onChange={(e) => handleUpdateUserTier(u.id, e.target.value)}
                          className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-white outline-none"
                        >
                          <option value="free">Free (3회)</option>
                          <option value="basic">Basic (30회)</option>
                          <option value="standard">Standard (100회)</option>
                          <option value="premium">Premium (150회)</option>
                        </select>

                        <button
                          onClick={() => handleToggleUserStatus(u.id, u.status)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium border ${u.status === "active"
                              ? "border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                              : "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                        >
                          {u.status === "active" ? "정지" : "복구"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. 은행 및 등급 설정 탭 */}
        {activeTab === "config" && config && (
          <form onSubmit={handleSaveConfig} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6 max-w-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              입금 계좌 및 등급별 생성 한도 설정
            </h3>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">은행명</label>
                <input
                  type="text"
                  value={config.bankName}
                  onChange={(e) => setConfig({ ...config, bankName: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-xs text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-300">계좌번호</label>
                <input
                  type="text"
                  value={config.accountNumber}
                  onChange={(e) => setConfig({ ...config, accountNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">예금주</label>
              <input
                type="text"
                value={config.accountHolder}
                onChange={(e) => setConfig({ ...config, accountHolder: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">입금 시 유의사항 문구</label>
              <textarea
                value={config.transferNotice}
                onChange={(e) => setConfig({ ...config, transferNotice: e.target.value })}
                rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 p-2.5 text-xs text-white"
              />
            </div>

            <div className="border-t border-slate-800 pt-4">
              <h4 className="text-xs font-bold text-white mb-3">등급별 월간 생성 횟수 설정</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-slate-400">Basic 횟수</label>
                  <input
                    type="number"
                    value={config.tierLimits.basic}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        tierLimits: { ...config.tierLimits, basic: Number(e.target.value) },
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Standard 횟수</label>
                  <input
                    type="number"
                    value={config.tierLimits.standard}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        tierLimits: { ...config.tierLimits, standard: Number(e.target.value) },
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Premium 횟수</label>
                  <input
                    type="number"
                    value={config.tierLimits.premium}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        tierLimits: { ...config.tierLimits, premium: Number(e.target.value) },
                      })
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 p-2.5 text-xs text-white mt-1"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition"
            >
              <Save className="h-4 w-4" />
              설정 저장하기
            </button>
          </form>
        )}

        {/* 5. 데이터 백업 & 복구 탭 */}
        {activeTab === "backups" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">데이터베이스 자동 백업 & 복구</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  회원 정보, 결제 내역, 로그의 SHA-256 무결성 검증 백업본을 관리합니다.
                </p>
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition"
              >
                <HardDrive className="h-4 w-4" />
                지금 즉시 백업 생성
              </button>
            </div>

            <div className="space-y-3">
              {backups.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">생성된 백업본이 없습니다.</p>
              ) : (
                backups.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-cyan-400">{b.id}</span>
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          무결성 검증 완료
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        생성 시각: {new Date(b.timestamp).toLocaleString()} · 파일 {b.totalFiles}개 ({(b.totalSizeBytes / 1024).toFixed(1)} KB)
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestoreBackup(b.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        이 시점으로 복원
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  sub,
  highlight,
  icon,
}: {
  title: string;
  value: string;
  sub: string;
  highlight?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 backdrop-blur-xl ${highlight ? "border-amber-500/50 bg-amber-500/10" : "border-slate-800 bg-slate-900/40"
      }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">{title}</span>
        {icon}
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{sub}</p>
    </div>
  );
}
