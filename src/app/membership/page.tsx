"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import {
  CreditCard,
  CheckCircle2,
  Copy,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ChevronRight,
} from "lucide-react";

interface BankConfig {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferNotice: string;
  tierLimits: Record<string, number>;
  tierPricesKRW: Record<string, number>;
}

interface TransferItem {
  id: string;
  tier: string;
  amountKRW: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  depositCode: string;
  depositorName: string;
  status: string;
  userMemo?: string;
  adminMemo?: string;
  createdAt: string;
  approvedAt?: string;
}

export default function MembershipPage() {
  const [user, setUser] = useState<any>(null);
  const [bankConfig, setBankConfig] = useState<BankConfig | null>(null);
  const [billingAvailable, setBillingAvailable] = useState(false);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [selectedTier, setSelectedTier] = useState<"basic" | "standard" | "premium">("standard");
  const [depositorName, setDepositorName] = useState("");
  const [userMemo, setUserMemo] = useState("");
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [authRes, transRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/membership/transfer"),
      ]);

      const authData = await authRes.json();
      if (authData.authenticated) {
        setUser(authData.user);
        setDepositorName(authData.user.name || "");
      }

      const transData = await transRes.json();
      setBillingAvailable(transData.billingAvailable === true);
      if (transData.bankConfig) {
        setBankConfig(transData.bankConfig);
      }
      if (transData.transfers) {
        setTransfers(transData.transfers);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handleCopyAccount() {
    if (!bankConfig) return;
    navigator.clipboard.writeText(
      `${bankConfig.bankName} ${bankConfig.accountNumber} ${bankConfig.accountHolder}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApplyTransfer(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (!depositorName.trim()) {
      setError("실제 입금하실 입금자명을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/membership/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: selectedTier,
          depositorName: depositorName.trim(),
          userMemo: userMemo.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "신청에 실패했습니다.");
      }

      setMessage("신청이 완료되었습니다! 아래 계좌로 입금 후 확인 버튼을 눌러주세요.");
      setActiveModal(false);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestConfirm(transferId: string) {
    setConfirmingId(transferId);
    try {
      const res = await fetch("/api/membership/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "확인 요청 실패");
      } else {
        alert(data.message || "입금 확인 요청이 접수되었습니다.");
        fetchData();
      }
    } catch {
      alert("네트워크 오류");
    } finally {
      setConfirmingId(null);
    }
  }

  const tiers = [
    {
      id: "basic",
      name: "Basic",
      limit: bankConfig?.tierLimits?.basic ?? 30,
      price: bankConfig?.tierPricesKRW?.basic ?? 29000,
      desc: "개인 크리에이터 및 취미 제작자를 위한 기본 플랜",
      features: [
        "월 30회 1080×1920 세로 숏츠 생성",
        "40대 남성 신뢰도 AI 보이스 (InJoon)",
        "바이럴 임팩트 자막 렌더링",
        "교육 & 공학 전체 카테고리 이용",
        "워터마크 없는 상업적 이용 가능 MP4",
      ],
      popular: false,
    },
    {
      id: "standard",
      name: "Standard",
      limit: bankConfig?.tierLimits?.standard ?? 100,
      price: bankConfig?.tierPricesKRW?.standard ?? 79000,
      desc: "본격적인 전문 유튜브 채널 운영자를 위한 베스트셀러",
      features: [
        "월 100회 대용량 숏츠 생성 (일일 3~4편)",
        "40대 남성 신뢰도 AI 보이스 (InJoon)",
        "바이럴 임팩트 자막 & 네온 하이라이트",
        "고등·수능·대학 심화 및 공학 메커니즘 특화",
        "생성 실패 시 크레딧 100% 자동 복구",
        "우선 렌더링 큐 배정",
      ],
      popular: true,
    },
    {
      id: "premium",
      name: "Premium",
      limit: bankConfig?.tierLimits?.premium ?? 150,
      price: bankConfig?.tierPricesKRW?.premium ?? 119000,
      desc: "대형 MCN, 학원, 에이전시를 위한 프로페셔널 플랜",
      features: [
        "월 150회 최대 용량 숏츠 생성 (일일 5편 이상)",
        "모든 고급 시각화 및 모션 메커니즘 지원",
        "초고속 렌더링 우선순위 부여",
        "실시간 기술 지원 및 맞춤 프롬프트 상담",
        "남은 크레딧 이월 보장",
      ],
      popular: false,
    },
  ];

  const statusMap: Record<string, { label: string; color: string }> = {
    pending_deposit: { label: "입금 대기", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
    verifying: { label: "입금 확인 중", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
    completed: { label: "활성화 완료", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
    rejected: { label: "입금 불일치/반려", color: "text-rose-400 bg-rose-400/10 border-rose-400/20" },
    refunded: { label: "환불 완료", color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-12">
        {/* 타이틀 헤더 */}
        <div className="mb-12 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300">
            <CreditCard className="h-3.5 w-3.5 text-amber-400" />
            멤버십 안내
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            브라우저 영상 생성은 무료입니다
          </h1>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto text-sm sm:text-base">
            브라우저 로컬 WebM 제작에는 로그인이나 크레딧이 필요하지 않습니다. 서버 렌더링과 영구 계정 저장소가 준비될 때까지 신규 결제 신청은 중지됩니다.
          </p>
        </div>

        {!billingAvailable && (
          <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              유료 렌더링은 현재 이용할 수 없습니다. 브라우저 영상 제작은 무료이며 결제가 발생하지 않습니다.
              별도 렌더러와 영구 데이터 저장소가 연결될 때까지 계좌 정보와 결제 신청을 표시하지 않습니다.
            </p>
          </div>
        )}

        {/* 내 현재 멤버십 상태 카드 */}
        {user && (
          <div className="mb-10 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-slate-400">현재 이용 중인 등급</span>
                <div className="flex items-center gap-3 mt-1">
                  <h3 className="text-2xl font-bold text-white uppercase">
                    {user.membershipTier} PLAN
                  </h3>
                  <span className="rounded-full bg-cyan-500/10 px-3 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
                    월 {user.monthlyLimit}회 한도
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-slate-400">이번 달 사용량</p>
                  <p className="text-lg font-bold text-white">
                    {user.usedCredits} / {user.monthlyLimit}회
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">잔여 횟수</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits}회
                  </p>
                </div>
                {user.nextResetDate && (
                  <div className="hidden md:block">
                    <p className="text-xs text-slate-400">다음 초기화</p>
                    <p className="text-xs font-mono text-slate-300 mt-1">
                      {new Date(user.nextResetDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 안내 메시지 */}
        {message && (
          <div className="mb-8 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* 플랜 그리드 */}
        <div className="grid gap-6 lg:grid-cols-3 mb-16">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={`relative flex flex-col justify-between rounded-3xl border p-8 transition-all duration-200 ${
                t.popular
                  ? "border-indigo-500/80 bg-gradient-to-b from-indigo-950/40 via-slate-900/80 to-slate-900 shadow-2xl shadow-indigo-500/10 ring-1 ring-indigo-500/50"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              {t.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-1 text-xs font-bold text-white shadow-md">
                  가장 추천하는 플랜
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xl font-bold text-white">{t.name}</h3>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-cyan-400">
                    {billingAvailable ? `월 ${t.limit}회 생성` : "유료 기능 준비 중"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mb-6">{t.desc}</p>

                <div className="mb-6 flex items-baseline gap-1">
                  {billingAvailable ? (
                    <>
                      <span className="text-3xl font-extrabold text-white">
                        {t.price.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-slate-400">원 / 월</span>
                    </>
                  ) : (
                    <span className="text-xl font-bold text-slate-400">현재 결제 중지</span>
                  )}
                </div>

                <div className="space-y-3 border-t border-slate-800/80 pt-6">
                  {(billingAvailable
                    ? t.features
                    : [
                        "기기 브라우저에서 대본 자막 포함 720×1280 WebM 생성",
                        "로컬 렌더링 · 서버 업로드 및 크레딧 차감 없음",
                        "AI 이미지, TTS 음성, MP4 서버 렌더링 미포함",
                      ]
                  ).map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedTier(t.id as any);
                  setActiveModal(true);
                }}
                disabled={!billingAvailable}
                className={`mt-8 w-full rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] ${
                  !billingAvailable
                    ? "cursor-not-allowed bg-slate-800 text-slate-500"
                    : t.popular
                    ? "bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-lg shadow-indigo-500/20 hover:brightness-110"
                    : "bg-slate-800 text-white hover:bg-slate-700"
                }`}
              >
                {billingAvailable ? `${t.name} 플랜 신청하기` : "결제 신청 일시 중지"}
              </button>
            </div>
          ))}
        </div>

        {/* 입금 안내 계좌 정보 박스 */}
        {billingAvailable && bankConfig && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 mb-16">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              공식 계좌이체 입금 안내
            </h3>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-5">
              <div>
                <p className="text-xs text-indigo-300 font-medium">입금 은행 및 계좌</p>
                <p className="text-xl font-mono font-bold text-white mt-1">
                  {bankConfig.bankName} {bankConfig.accountNumber}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  예금주: <span className="text-white font-semibold">{bankConfig.accountHolder}</span>
                </p>
              </div>

              <button
                onClick={handleCopyAccount}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-500 transition active:scale-[0.98]"
              >
                <Copy className="h-4 w-4" />
                {copied ? "계좌번호 복사됨!" : "계좌번호 복사"}
              </button>
            </div>

            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              💡 {bankConfig.transferNotice}
            </p>
          </div>
        )}

        {/* 내 입금 신청 내역 */}
        {transfers.length > 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Clock className="h-5 w-5 text-cyan-400" />
              내 계좌이체 신청 내역
            </h3>

            <div className="space-y-4">
              {transfers.map((item) => {
                const st = statusMap[item.status] || {
                  label: item.status,
                  color: "text-slate-400 bg-slate-800",
                };
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/80 p-5"
                  >
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-base font-bold text-white uppercase">
                          {item.tier} 플랜
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${st.color}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        신청금액: <span className="text-white font-semibold">{item.amountKRW.toLocaleString()}원</span> · 
                        입금자명: <span className="text-cyan-300 font-medium">{item.depositorName}</span> · 
                        고유코드: <span className="font-mono text-amber-400 font-bold">{item.depositCode}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        신청일: {new Date(item.createdAt).toLocaleString()}
                        {item.adminMemo && ` · 관리자 메모: ${item.adminMemo}`}
                      </p>
                    </div>

                    {item.status === "pending_deposit" && (
                      <button
                        onClick={() => handleRequestConfirm(item.id)}
                        disabled={confirmingId === item.id}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 active:scale-[0.98] transition disabled:opacity-50"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {confirmingId === item.id ? "요청 중..." : "입금 완료 확인 요청"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 계좌이체 신청 모달 */}
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 sm:p-8 shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2">
                {selectedTier.toUpperCase()} 멤버십 계좌이체 신청
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                입금자 정보를 입력해주시면 입금 확인 즉시 멤버십이 활성화됩니다.
              </p>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleApplyTransfer} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    신청 플랜
                  </label>
                  <div className="flex gap-2">
                    {(["basic", "standard", "premium"] as const).map((tier) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        className={`flex-1 rounded-xl py-2 text-xs font-semibold uppercase border transition ${
                          selectedTier === tier
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                            : "border-slate-800 bg-slate-800/40 text-slate-400"
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    실제 입금하실 입금자명
                  </label>
                  <input
                    type="text"
                    required
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    추가 메모 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={userMemo}
                    onChange={(e) => setUserMemo(e.target.value)}
                    placeholder="예: 신속 확인 부탁드립니다"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-3.5 py-2.5 text-sm text-white focus:border-cyan-500 outline-none"
                  />
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400 space-y-1">
                  <p>
                    결제 예정 금액:{" "}
                    <span className="text-white font-bold text-sm">
                      {bankConfig?.tierPricesKRW[selectedTier]?.toLocaleString()}원
                    </span>
                  </p>
                  <p>
                    입금 계좌: {bankConfig?.bankName} {bankConfig?.accountNumber} ({bankConfig?.accountHolder})
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setActiveModal(false)}
                    className="flex-1 rounded-xl border border-slate-700 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 py-3 text-xs font-semibold text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {submitting ? "신청 중..." : "신청 완료하기"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
