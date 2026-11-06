"use client";

import { calculateCostEstimate, formatDuration, formatKRW } from "@/lib/timing";
import { CLIP_DURATION_SEC, CREDITS_PER_CLIP } from "@/types";

interface CostCalculatorProps {
  audioDurationSec: number;
}

export function CostCalculator({ audioDurationSec }: CostCalculatorProps) {
  const { keyframeCount, clipCount, totalCredits, costKRW } =
    calculateCostEstimate(audioDurationSec);

  return (
    <div className="card p-6">
      <h3 className="mb-4 text-sm font-medium text-gray-400">비용 & 리소스 예측</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="음성 길이" value={formatDuration(audioDurationSec)} />
        <Stat label="키프레임" value={`${keyframeCount}장`} />
        <Stat label="영상 클립" value={`${clipCount}개 (${CLIP_DURATION_SEC}초)`} />
        <Stat
          label="예상 비용"
          value={formatKRW(costKRW)}
          highlight
        />
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Google Omni Flash · {CREDITS_PER_CLIP}크레딧/클립 · 총 {totalCredits}크레딧
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-lg font-bold ${highlight ? "text-brand-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
