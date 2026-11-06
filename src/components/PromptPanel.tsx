"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { copyToClipboard, downloadTextFile } from "@/lib/utils";

interface PromptPanelProps {
  title: string;
  description: string;
  prompts: string;
  stepNumber: number;
  googleFlowTip?: string;
  onComplete?: () => void;
}

export function PromptPanel({
  title,
  description,
  prompts,
  stepNumber,
  googleFlowTip,
  onComplete,
}: PromptPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await copyToClipboard(prompts);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    downloadTextFile(prompts, `step${stepNumber}_prompts.txt`);
  }

  return (
    <div className="card animate-slide-up p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <span className="mb-1 inline-block rounded bg-brand-600/20 px-2 py-0.5 text-xs font-medium text-brand-400">
            Step {stepNumber}
          </span>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCopy} className="btn-secondary text-xs">
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "복사됨" : "복사"}
          </button>
          <button onClick={handleDownload} className="btn-secondary text-xs">
            <Download className="h-3.5 w-3.5" />
            다운로드
          </button>
        </div>
      </div>

      {googleFlowTip && (
        <div className="mb-4 rounded-lg border border-amber-700/30 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
          💡 {googleFlowTip}
        </div>
      )}

      <pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">
        {prompts}
      </pre>

      {onComplete && (
        <div className="mt-4 flex justify-end">
          <button onClick={onComplete} className="btn-primary">
            <Check className="h-4 w-4" />
            이 단계 완료
          </button>
        </div>
      )}
    </div>
  );
}
