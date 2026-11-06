"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { CostCalculator } from "@/components/CostCalculator";
import { createProject } from "@/lib/storage";
import { calculateKeyframeCount } from "@/lib/timing";

const SAMPLE_SCRIPT = `공기의 흐름을 이해하면 비행기 날개의 원리를 알 수 있습니다.
날개 위쪽은 볼록하고 아래쪽은 평평합니다.
비행기가 앞으로 나아가면 공기가 날개를 갈라집니다.
위쪽 공기는 더 긴 경로를 이동해야 하므로 속도가 빨라집니다.
베르누이 원리에 따라 빠른 공기는 압력이 낮아집니다.
아래쪽은 느린 공기로 압력이 높게 유지됩니다.
이 압력 차이가 날개를 위로 밀어 올리는 양력을 만듭니다.
각도를 조절하면 상승과 하강을 제어할 수 있습니다.`;

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [script, setScript] = useState("");
  const [audioDurationSec, setAudioDurationSec] = useState(60);
  const [loading, setLoading] = useState(false);

  const keyframeCount = calculateKeyframeCount(audioDurationSec);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !script.trim()) return;

    setLoading(true);
    const project = createProject({
      title: title.trim(),
      topic: topic.trim() || title.trim(),
      script: script.trim(),
      audioDurationSec,
    });
    router.push(`/project/${project.id}`);
  }

  function loadSample() {
    setTitle("비행기 날개의 원리");
    setTopic("양력과 베르누이 원리");
    setScript(SAMPLE_SCRIPT);
    setAudioDurationSec(45);
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </Link>

        <h1 className="mb-2 text-2xl font-bold text-white">새 프로젝트</h1>
        <p className="mb-8 text-gray-400">
          대본과 음성 길이를 입력하면 키프레임·프롬프트가 자동 생성됩니다.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card space-y-5 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">
                프로젝트 제목
              </label>
              <input
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 비행기 날개의 원리"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">
                주제 / 키워드
              </label>
              <input
                className="input"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: 양력, 베르누이 원리, 유체역학"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">
                  대본
                </label>
                <button
                  type="button"
                  onClick={loadSample}
                  className="text-xs text-brand-400 hover:text-brand-300"
                >
                  샘플 대본 불러오기
                </button>
              </div>
              <textarea
                className="textarea min-h-[200px]"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="내레이션 대본을 입력하세요..."
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                {script.length}자 · 약 {Math.ceil(script.length / 300)}분 분량
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-300">
                TTS 음성 길이 (초)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={15}
                  max={180}
                  value={audioDurationSec}
                  onChange={(e) => setAudioDurationSec(Number(e.target.value))}
                  className="flex-1 accent-brand-500"
                />
                <span className="w-16 text-right text-sm font-mono text-brand-400">
                  {audioDurationSec}초
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                TTS 생성 후 실제 길이를 입력하세요. 키프레임 {keyframeCount}장
                (장당 2~4초)
              </p>
            </div>
          </div>

          <CostCalculator audioDurationSec={audioDurationSec} />

          <button
            type="submit"
            disabled={loading || !title.trim() || !script.trim()}
            className="btn-primary w-full py-3 text-base"
          >
            <Sparkles className="h-5 w-5" />
            {loading ? "생성 중..." : "프롬프트 생성 & 프로젝트 시작"}
          </button>
        </form>
      </main>
    </div>
  );
}
