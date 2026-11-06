"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Film, Zap, CreditCard, Sparkles, ChevronRight, CheckCircle2, ShieldCheck, Play } from "lucide-react";
import { Header, HeroSection } from "@/components/Header";
import { ProjectCard } from "@/components/ProjectCard";
import { getAllProjects } from "@/lib/storage";
import type { Project } from "@/types";

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    setProjects(getAllProjects());
  }, []);

  function refresh() {
    setProjects(getAllProjects());
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <Header />
      <HeroSection />

      <main className="mx-auto max-w-6xl px-4 space-y-16">
        {/* 주요 핵심 특징 3단 카드 */}
        <div className="grid gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<Zap className="h-6 w-6 text-cyan-400" />}
            title="원클릭 숏츠 파이프라인"
            desc="주제만 넣으면 40대 남성 신뢰감 보이스와 2~4단어 임팩트 자막, 1080×1920 세로 영상이 1분 안에 완성됩니다."
          />
          <FeatureCard
            icon={<Sparkles className="h-6 w-6 text-indigo-400" />}
            title="교육 & 공학 심화 특화"
            desc="고등·수능 킬러 개념부터 기계, 항공, 반도체 메커니즘까지 정확한 용어와 시각화로 몰입도를 극대화합니다."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6 text-emerald-400" />}
            title="30 / 100 / 150회 멤버십"
            desc="수수료 없는 계좌이체 간편 활성화로 원하는 만큼 영상을 안정적으로 대량 생산할 수 있습니다."
          />
        </div>

        {/* 내 프로젝트 목록 섹션 */}
        <div>
          <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">내 수동 프로젝트 보관함</h2>
              <p className="text-xs text-slate-400 mt-0.5">Google Flow 및 세부 프롬프트로 작업한 프로젝트</p>
            </div>
            <Link
              href="/new"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              새 프로젝트 작성
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
                <Film className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-300 mb-1">
                보관 중인 프로젝트가 없습니다
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                새 프로젝트를 생성하거나, 원클릭 자동 생성기로 1분 만에 첫 쇼츠를 만들어보세요.
              </p>
              <div className="flex justify-center gap-3">
                <Link
                  href="/auto"
                  className="rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-cyan-500 transition"
                >
                  AI 쇼츠 자동 생성 시작
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} onDelete={refresh} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-xl">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700/50">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
