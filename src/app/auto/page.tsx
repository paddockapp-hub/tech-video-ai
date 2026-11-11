"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  GraduationCap,
  Cpu,
  RefreshCw,
  Layers,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/Header";
import { CATEGORIES } from "@/lib/categories";
import { generateScriptTemplate } from "@/lib/script-generator";
import { renderBrowserVideo } from "@/lib/browser-video";

type PipelineStatus = "idle" | "generating" | "success" | "error";

interface PipelineResult {
  video: string;
  durationSec: number;
  format: string;
  provenance: string;
  qualityPassed: boolean;
  qualityReport: string;
}

function estimateDuration(script: string) {
  return Math.max(12, Math.min(30, Math.ceil(script.length / 7)));
}

export default function AutoPage() {
  const [user, setUser] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<"education" | "engineering">("engineering");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("mechanical-automotive");
  const [title, setTitle] = useState("비행기 날개의 원리와 양력 발생");
  const [script, setScript] = useState("");
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const videoRef = useRef<HTMLVideoElement>(null);

  const activeCategoryGroup = CATEGORIES.find((c) => c.id === selectedCategory);
  const activeSubcategory = activeCategoryGroup?.items.find((i) => i.id === selectedSubcategory);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) setUser(data.user);
      })
      .catch(() => {});

    // 초기 대본 생성
    handleAutoGenerateScript();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 시 1회만 초기화하기 위한 의도된 의존성 생략
  }, []);

  useEffect(() => {
    return () => {
      if (result?.video) URL.revokeObjectURL(result.video);
    };
  }, [result?.video]);

  // 카테고리 전환 시 기본 세부항목 선택
  function handleSelectCategory(catId: "education" | "engineering") {
    setSelectedCategory(catId);
    const grp = CATEGORIES.find((c) => c.id === catId);
    if (grp && grp.items.length > 0) {
      setSelectedSubcategory(grp.items[0].id);
      loadSubcategoryDefaults(catId, grp.items[0].id);
    }
  }

  function handleSelectSubcategory(subId: string) {
    setSelectedSubcategory(subId);
    loadSubcategoryDefaults(selectedCategory, subId);
  }

  function loadSubcategoryDefaults(catId: string, subId: string) {
    const res = generateScriptTemplate({
      category: catId,
      subcategory: subId,
      targetDurationSec: 45,
    });
    setTitle(res.title);
    setScript(res.narrationScript);
  }

  function handleAutoGenerateScript(customTopic = title) {
    const res = generateScriptTemplate({
      category: selectedCategory,
      subcategory: selectedSubcategory,
      customTopic,
      targetDurationSec: 45,
    });
    setScript(res.narrationScript);
  }

  async function handleGenerate() {
    if (!script.trim() || !title.trim()) return;

    setStatus("generating");
    setError("");
    setResult(null);
    setElapsed(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const durationSec = estimateDuration(script.trim());
    setProgress("브라우저에서 실제 WebM 영상 장면을 렌더링 중...");

    try {
      const blob = await renderBrowserVideo({
        script: script.trim(),
        title: title.trim(),
        category: selectedCategory,
        durationSec,
        onProgress: (progress) => {
          setProgress(`브라우저에서 영상 인코딩 중... ${Math.round(progress * 100)}%`);
        },
      });
      const video = URL.createObjectURL(blob);

      setResult({
        video,
        durationSec,
        format: blob.type || "video/webm",
        provenance: "3D 실시간 그래픽 & 오디오 렌더링",
        qualityPassed: blob.size > 0,
        qualityReport: `3D 세로 숏츠 생성 완료 · ${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
      });
      setStatus("success");
      setProgress("완료되었습니다!");
    } catch (err: any) {
      setError(err.message || "영상 파이프라인 처리 중 오류가 발생했습니다.");
      setStatus("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>

          {user && (
            <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3.5 py-1 text-xs">
              <span className="text-slate-400">잔여 횟수:</span>
              <span className="font-bold text-cyan-400">
                {Math.max(0, user.monthlyLimit - user.usedCredits) + user.bonusCredits}회
              </span>
              <Link href="/membership" className="text-indigo-400 font-semibold hover:underline ml-1">
                충전
              </Link>
            </div>
          )}
        </div>

        {/* 상단 타이틀 */}
        <div className="mb-8">
          <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1 text-xs font-semibold text-cyan-300">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            3D 고품질 쇼츠 렌더링 엔진
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            3D 과학 & 공학 메커니즘 숏츠 제작기
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            입체 3D 지오메트리, 네온 파티클 필드, 바이럴 하이라이트 자막 및 사운드트랙이 결합된 고퀄리티 9:16 쇼츠 영상을 원클릭으로 제작합니다.
          </p>
        </div>

        {/* 1. 카테고리 탭 선택 (교육 vs 공학) */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleSelectCategory("engineering")}
            className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
              selectedCategory === "engineering"
                ? "border-cyan-500 bg-gradient-to-r from-cyan-950/40 to-slate-900 ring-1 ring-cyan-500/50 shadow-lg shadow-cyan-500/10"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              selectedCategory === "engineering" ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-800 text-slate-400"
            }`}>
              <Cpu className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">공학 카테고리</p>
              <p className="text-xs text-slate-400 mt-0.5">기계, 항공, 반도체, AI 등 내부 메커니즘 중심</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCategory("education")}
            className={`flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all ${
              selectedCategory === "education"
                ? "border-indigo-500 bg-gradient-to-r from-indigo-950/40 to-slate-900 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-500/10"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
            }`}
          >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              selectedCategory === "education" ? "bg-indigo-500/20 text-indigo-400" : "bg-slate-800 text-slate-400"
            }`}>
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">교육 카테고리</p>
              <p className="text-xs text-slate-400 mt-0.5">수능, 고등과정, 수학, 물리, 대학 전공 지식</p>
            </div>
          </button>
        </div>

        {/* 2. 세부 분야 선택 알약 버튼들 */}
        {activeCategoryGroup && (
          <div className="mb-6 flex flex-wrap gap-2">
            {activeCategoryGroup.items.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => handleSelectSubcategory(sub.id)}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold border transition ${
                  selectedSubcategory === sub.id
                    ? "border-cyan-400 bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/30"
                    : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-white"
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}

        {/* 3. 바이럴 후킹 추천 알약 */}
        {activeSubcategory && activeSubcategory.recommendedHooks.length > 0 && (
          <div className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
            <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              추천 1~3초 바이럴 후킹 문장 (클릭 시 제목에 적용)
            </span>
            <div className="flex flex-wrap gap-2">
              {activeSubcategory.recommendedHooks.map((hk, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setTitle(hk);
                    handleAutoGenerateScript(hk);
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 hover:border-indigo-500 hover:text-indigo-300 transition text-left"
                >
                  &ldquo;{hk}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. 입력 폼 */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-xl space-y-6">
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-300">
              프로젝트 제목 / 주제 (사용자 직접 입력 가능)
            </label>
            <input
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 4행정 엔진 실린더 폭발의 원리"
              disabled={status === "generating"}
              className="w-full rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-cyan-500 outline-none"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                나레이션 스크립트 (줄바꿈 단위로 문장이 분할됩니다)
              </label>
              <button
                type="button"
                onClick={() => handleAutoGenerateScript()}
                disabled={status === "generating"}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition"
              >
                <RefreshCw className="h-3 w-3" />
                대본 템플릿 다시 생성
              </button>
            </div>
            <textarea
              rows={8}
              value={script}
              maxLength={1500}
              onChange={(e) => setScript(e.target.value)}
              placeholder="나레이션 스크립트를 입력하세요..."
              disabled={status === "generating"}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800/60 p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 outline-none font-sans leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{script.length}자 · 약 {Math.round(script.length / 5.5)}초 분량</span>
              <span>브라우저 렌더 · 예상 {estimateDuration(script)}초 · 음성 없음</span>
            </div>
          </div>

          {/* 파이프라인 시작 버튼 */}
          <button
            onClick={handleGenerate}
            disabled={status === "generating" || !script.trim() || !title.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 py-4 text-base font-bold text-white shadow-xl shadow-indigo-600/25 hover:brightness-110 active:scale-[0.98] transition disabled:opacity-50"
          >
            {status === "generating" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                영상 제작 진행 중... ({elapsed}초)
              </>
            ) : (
              <>
                <Zap className="h-5 w-5" />
                무료 브라우저 영상 만들기 (WebM)
              </>
            )}
          </button>
        </div>

        {/* 5. 생성 진행 상태 */}
        {status === "generating" && (
          <div className="mt-8 rounded-3xl border border-indigo-500/30 bg-slate-900/60 p-6 backdrop-blur-xl">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
              브라우저에서 영상 렌더링 중... ({elapsed}초)
            </h3>

            <div className="space-y-3">
              <StepRow
                label="제목·카테고리 기반 그래픽 장면 그리기"
                active={elapsed < 2}
                done={elapsed >= 2}
              />
              <StepRow
                label="대본 자막을 영상 프레임에 합성"
                active={elapsed >= 2}
                done={false}
              />
            </div>

            <p className="mt-4 text-xs text-slate-400">{progress}</p>
          </div>
        )}

        {/* 에러 박스 */}
        {status === "error" && (
          <div className="mt-8 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6">
            <div className="flex items-center gap-2 text-rose-400 font-bold mb-2">
              <AlertCircle className="h-5 w-5" />
              <span>오류 발생</span>
            </div>
            <p className="text-xs text-rose-300 whitespace-pre-wrap">{error}</p>
            {error.includes("크레딧") && (
              <Link
                href="/membership"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition"
              >
                멤버십 크레딧 충전하러 가기
              </Link>
            )}
          </div>
        )}

        {/* 6. 최종 완성 결과 및 프리뷰 */}
        {status === "success" && result && (
          <div className="mt-8 rounded-3xl border border-emerald-500/40 bg-slate-900/80 p-6 sm:p-8 backdrop-blur-xl">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-2">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  브라우저 렌더 완료 ({elapsed}초 소요)
                </div>
                <h3 className="text-xl font-bold text-white">실제 영상 파일이 생성되었습니다</h3>
              </div>

              {/* 품질 검증 통과 뱃지 */}
              <div className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/20 px-3.5 py-2 text-xs font-semibold text-cyan-300">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <span>{result.qualityReport}</span>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-2 items-center">
              {/* 세로 비디오 플레이어 */}
              {result.video && (
                <div className="relative mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-700 bg-black shadow-2xl">
                  <video
                    ref={videoRef}
                    src={result.video}
                    controls
                    autoPlay
                    playsInline
                    className="w-full"
                    style={{ aspectRatio: "9/16" }}
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-2">
                  <p className="text-xs font-semibold text-slate-400">적용된 스펙</p>
                  <p className="text-xs text-slate-300">· 포맷: 3D {result.format} · 720×1280 (9:16 세로형)</p>
                  <p className="text-xs text-slate-300">· 길이: 약 {result.durationSec}초 · 신디사이저 사운드트랙 포함</p>
                  <p className="text-xs text-slate-300">· 비주얼: 3D 입체 지오메트리 & 네온 파티클</p>
                  <p className="text-xs text-slate-300">· 자막: 바이럴 임팩트 하이라이트 텍스트</p>
                </div>

                <div className="grid gap-3">
                  {result.video && (
                    <a
                      href={result.video}
                      download={`${title.replace(/[\\/:*?"<>|]+/g, "_").trim().slice(0, 60) || "shorts"}.webm`}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 py-3.5 text-sm font-bold text-white shadow-lg hover:brightness-110 active:scale-[0.98] transition"
                    >
                      <Download className="h-4 w-4" />
                      WebM 영상 다운로드
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StepRow({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-slate-700 shrink-0" />
      )}
      <span
        className={`text-xs ${
          done
            ? "text-emerald-300"
            : active
            ? "text-white font-semibold"
            : "text-slate-500"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
