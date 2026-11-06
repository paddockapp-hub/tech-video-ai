"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  ExternalLink,
  Mic,
  Scissors,
} from "lucide-react";
import { Header } from "@/components/Header";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { PromptPanel } from "@/components/PromptPanel";
import { CostCalculator } from "@/components/CostCalculator";
import {
  getProject,
  updateProjectStatus,
  regenerateKeyframes,
} from "@/lib/storage";
import {
  generateAllPromptsText,
  generateGoogleFlowInstructions,
} from "@/lib/prompt-generator";
import { downloadTextFile } from "@/lib/utils";
import type { Project, ProjectStatus } from "@/types";

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [activeStep, setActiveStep] = useState<string>("keyframes");
  const [clipFiles, setClipFiles] = useState("");

  const refresh = useCallback(() => {
    const p = getProject(id);
    if (p) {
      setProject(p);
      setActiveStep(p.status === "script" ? "keyframes" : p.status);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleStepComplete(status: ProjectStatus) {
    updateProjectStatus(id, status);
    refresh();
  }

  function handleRegenerate() {
    regenerateKeyframes(id);
    refresh();
  }

  function handleExportGuide() {
    if (!project) return;
    const guide = generateGoogleFlowInstructions(project);
    downloadTextFile(guide, `${project.title}_guide.md`);
  }

  if (!project) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <p>프로젝트를 찾을 수 없습니다.</p>
          <Link href="/" className="mt-4 text-brand-400 hover:underline">
            홈으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              프로젝트 목록
            </Link>
            <h1 className="text-2xl font-bold text-white">{project.title}</h1>
            <p className="text-sm text-gray-400">{project.topic}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRegenerate} className="btn-secondary text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              프롬프트 재생성
            </button>
            <button onClick={handleExportGuide} className="btn-primary text-xs">
              <Download className="h-3.5 w-3.5" />
              전체 가이드 MD
            </button>
          </div>
        </div>

        <div className="mb-6">
          <CostCalculator audioDurationSec={project.audioDurationSec} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <WorkflowStepper
            currentStatus={project.status}
            onStepClick={setActiveStep}
          />

          <div className="space-y-6">
            {activeStep === "keyframes" && (
              <PromptPanel
                stepNumber={1}
                title="키프레임 이미지 프롬프트"
                description="인포그래픽 없는 기본 이미지를 Google Flow에서 생성합니다."
                prompts={generateAllPromptsText(project.keyframes, "base")}
                googleFlowTip="Google Flow 에이전트 모드(흰색 불)를 켜고 아래 프롬프트를 붙여넣으세요."
                onComplete={() => handleStepComplete("infographics")}
              />
            )}

            {activeStep === "infographics" && (
              <PromptPanel
                stepNumber={2}
                title="인포그래픽 이미지 프롬프트"
                description="Step 1 이미지에 인포그래픽을 추가한 버전을 생성합니다."
                prompts={generateAllPromptsText(
                  project.keyframes,
                  "infographic"
                )}
                googleFlowTip="같은 구도에 인포그래픽만 추가하는 것이 핵심입니다."
                onComplete={() => handleStepComplete("videos")}
              />
            )}

            {activeStep === "videos" && (
              <PromptPanel
                stepNumber={3}
                title="영상 클립 프롬프트"
                description="기본 이미지 + 인포그래픽 이미지 쌍으로 4초 모션 클립을 생성합니다."
                prompts={generateAllPromptsText(project.keyframes, "video")}
                googleFlowTip="Google Omni Flash 모델, 4초 클립. 생성 후 '프로젝트 다운로드'로 ZIP 받기."
                onComplete={() => handleStepComplete("audio")}
              />
            )}

            {activeStep === "audio" && (
              <div className="card animate-slide-up p-6">
                <span className="mb-1 inline-block rounded bg-brand-600/20 px-2 py-0.5 text-xs font-medium text-brand-400">
                  Step 4
                </span>
                <h2 className="mb-1 text-xl font-bold text-white">
                  TTS 음성 생성
                </h2>
                <p className="mb-4 text-sm text-gray-400">
                  Google Generate Speech에서 아래 설정으로 음성을 생성하세요.
                </p>

                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  <SettingBadge label="모델" value="Gemini 2.5 Pro" />
                  <SettingBadge label="목소리" value="Achird" />
                  <SettingBadge label="속도" value="Rapid Fire" />
                </div>

                <pre className="mb-4 max-h-60 overflow-auto rounded-lg bg-gray-950 p-4 text-sm text-gray-300 whitespace-pre-wrap">
                  {project.script}
                </pre>

                <div className="flex items-center justify-between">
                  <a
                    href="https://aistudio.google.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Google AI Studio
                  </a>
                  <button
                    onClick={() => handleStepComplete("editing")}
                    className="btn-primary"
                  >
                    <Mic className="h-4 w-4" />
                    음성 생성 완료
                  </button>
                </div>
              </div>
            )}

            {activeStep === "editing" && (
              <div className="card animate-slide-up p-6">
                <span className="mb-1 inline-block rounded bg-brand-600/20 px-2 py-0.5 text-xs font-medium text-brand-400">
                  Step 5
                </span>
                <h2 className="mb-1 text-xl font-bold text-white">
                  편집 & 완성
                </h2>
                <p className="mb-4 text-sm text-gray-400">
                  영상 클립과 음성을 편집 프로그램에서 합칩니다.
                </p>

                <ol className="mb-6 space-y-3 text-sm text-gray-300">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold">
                      1
                    </span>
                    Google Flow ZIP 압축 해제 후 클립 파일명 입력
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold">
                      2
                    </span>
                    CapCut / Premiere에서 음성에 맞춰 클립 배치
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold">
                      3
                    </span>
                    효과음 볼륨 낮추기, Vrew로 자막 추가
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold">
                      4
                    </span>
                    9:16 세로 비율로 렌더링
                  </li>
                </ol>

                <div className="mb-4">
                  <label className="mb-1.5 block text-sm text-gray-400">
                    다운로드한 클립 파일명 (한 줄에 하나)
                  </label>
                  <textarea
                    className="textarea font-mono text-xs"
                    value={clipFiles}
                    onChange={(e) => setClipFiles(e.target.value)}
                    placeholder={"clip_a1b2.mp4\nclip_c3d4.mp4\n..."}
                  />
                </div>

                {clipFiles.trim() && (
                  <div className="mb-4 rounded-lg bg-gray-950 p-4">
                    <p className="mb-2 text-xs text-gray-500">
                      제안 파일명 (대본 순서):
                    </p>
                    {clipFiles
                      .split("\n")
                      .filter(Boolean)
                      .map((name, i) => (
                        <p key={i} className="font-mono text-sm text-brand-300">
                          {String(i + 1).padStart(2, "0")}_{name.trim()}
                        </p>
                      ))}
                  </div>
                )}

                <button
                  onClick={() => handleStepComplete("complete")}
                  className="btn-primary"
                >
                  <Scissors className="h-4 w-4" />
                  편집 완료
                </button>
              </div>
            )}

            {activeStep === "script" && (
              <div className="card p-6">
                <h2 className="mb-2 text-xl font-bold text-white">대본</h2>
                <pre className="rounded-lg bg-gray-950 p-4 text-sm text-gray-300 whitespace-pre-wrap">
                  {project.script}
                </pre>
              </div>
            )}

            {/* Keyframe detail table */}
            {(activeStep === "keyframes" ||
              activeStep === "infographics" ||
              activeStep === "videos") && (
              <div className="card p-6">
                <h3 className="mb-4 text-sm font-medium text-gray-400">
                  키프레임 상세 ({project.keyframes.length}장)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs text-gray-500">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">길이</th>
                        <th className="pb-2">대본 구간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {project.keyframes.map((kf) => (
                        <tr
                          key={kf.id}
                          className="border-b border-gray-800/50"
                        >
                          <td className="py-2 pr-4 font-mono text-brand-400">
                            {String(kf.index).padStart(2, "0")}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">
                            {kf.durationSec}s
                          </td>
                          <td className="py-2 text-gray-300 line-clamp-2">
                            {kf.scriptSegment}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function SettingBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-white">{value}</p>
    </div>
  );
}
