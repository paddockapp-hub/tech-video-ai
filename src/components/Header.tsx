"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Zap, CreditCard, Shield, User, LogOut, LogIn, UserPlus } from "lucide-react";

interface UserState {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  membershipTier: string;
  monthlyLimit: number;
  usedCredits: number;
  bonusCredits: number;
}

export function Header() {
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/";
  }

  const remaining = user
    ? Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits
    : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <Film className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">
                ShortsMaking
              </span>
              <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                PRO
              </span>
            </div>
            <p className="hidden text-xs text-slate-400 sm:block">
              교육 & 공학 영상 자동화
            </p>
          </div>
        </Link>

        {/* 네비게이션 */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/auto"
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all"
          >
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">AI 숏츠</span> 자동 생성
          </Link>

          <Link
            href="/membership"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/80 hover:text-white transition-all"
          >
            <CreditCard className="h-4 w-4 text-amber-400" />
            <span>멤버십</span>
          </Link>

          {user?.role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 transition-all"
            >
              <Shield className="h-4 w-4" />
              <span>관리자</span>
            </Link>
          )}

          {/* 인증 상태 */}
          {!loading && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right md:block">
                    <p className="text-xs font-semibold text-white">
                      {user.name} ({user.membershipTier.toUpperCase()})
                    </p>
                    <p className="text-[11px] font-medium text-cyan-400">
                      잔여 {remaining}회 / {user.monthlyLimit}회
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="로그아웃"
                    className="inline-flex items-center justify-center rounded-lg border border-slate-800 p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:text-white"
                  >
                    <LogIn className="h-4 w-4" />
                    로그인
                  </Link>
                  <Link
                    href="/signup"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-500 transition"
                  >
                    <UserPlus className="h-4 w-4" />
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 px-4 text-center">
      {/* 백그라운드 발광 효과 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-indigo-600/20 via-cyan-500/15 to-transparent blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-3xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-300">
          <Zap className="h-3.5 w-3.5 text-cyan-400" />
          교육(수능·대학) & 공학(작동원리) 특화 영상 자동화
        </div>

        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          지식을 시각화하는
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-purple-400 bg-clip-text text-transparent">
            고퀄리티 AI 쇼츠 제작
          </span>
        </h1>

        <p className="mx-auto max-w-xl text-base text-slate-300 sm:text-lg leading-relaxed">
          스크립트나 키워드만 입력하면 신뢰감 있는 40대 남성 보이스와
          <br className="hidden sm:block" />
          바이럴 자막, 정밀 메커니즘 애니메이션이 결합된 1080×1920 MP4가 완성됩니다.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href="/auto"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-7 py-3.5 text-base font-semibold text-white shadow-xl shadow-indigo-500/25 hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Zap className="h-5 w-5" />
            원클릭 자동 영상 제작
          </Link>
          <Link
            href="/membership"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-7 py-3.5 text-base font-semibold text-slate-200 hover:border-slate-600 hover:bg-slate-800 active:scale-[0.98] transition-all"
          >
            <CreditCard className="h-5 w-5 text-amber-400" />
            멤버십 플랜 (30/100/150회)
          </Link>
        </div>
      </div>
    </section>
  );
}
