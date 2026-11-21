import {
  AI_VIDEO_EXPECTED_COST_USD,
  AI_VIDEO_MAX_COST_USD,
  AI_VIDEO_TOTAL_DURATION_SEC,
  SEEDANCE_MODEL_LABEL,
} from "@/lib/ai-video-config";

export type RenderMode = "local3d" | "ai1080";

interface RenderModeSelectorProps {
  value: RenderMode;
  onChange: (mode: RenderMode) => void;
  aiAvailable: boolean;
}

export function RenderModeSelector({
  value,
  onChange,
  aiAvailable,
}: RenderModeSelectorProps) {
  const options: Array<{
    id: RenderMode;
    title: string;
    badge: string;
    description: string;
    disabled?: boolean;
  }> = [
    {
      id: "local3d",
      title: "로컬 3D 렌더",
      badge: "무료",
      description: "기존 브라우저 3D 엔진 · 생성 API 비용 없음",
    },
    {
      id: "ai1080",
      title: "AI 시네마틱 1080p",
      badge: `약 $${AI_VIDEO_EXPECTED_COST_USD.toFixed(2)} / 편`,
      description: `${SEEDANCE_MODEL_LABEL} · ${AI_VIDEO_TOTAL_DURATION_SEC}초 · 1080×1920`,
      disabled: !aiAvailable,
    },
  ];

  return (
    <fieldset className="mb-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
      <legend className="px-2 text-sm font-bold text-white">렌더 방식</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <label
              key={option.id}
              className={`relative flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                option.disabled
                  ? "cursor-not-allowed border-slate-800 bg-slate-950/40 opacity-60"
                  : selected
                    ? "border-cyan-500 bg-cyan-950/30 ring-1 ring-cyan-500/40"
                    : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
              }`}
            >
              <input
                type="radio"
                name="render-mode"
                value={option.id}
                checked={selected}
                disabled={option.disabled}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  selected ? "border-cyan-400" : "border-slate-600"
                }`}
              >
                {selected && <span className="h-2 w-2 rounded-full bg-cyan-400" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{option.title}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      option.id === "ai1080"
                        ? "bg-amber-400/10 text-amber-300"
                        : "bg-emerald-400/10 text-emerald-300"
                    }`}
                  >
                    {option.badge}
                  </span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        현재 Gateway 단가($0.049/초) 기준 30초 예상 $1.47입니다. 최대 12초 클립 3개와 $0.055/초 가격 상한을 적용해 모델 사용료 계산상 최대 $1.98로 제한하며, 가격이 상한을 넘으면 생성을 차단합니다. 자동 재시도는 없고, 실패 전에 완료된 클립은 비용이 청구될 수 있습니다.
      </p>
      {!aiAvailable && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-300/90">
          AI 유료 생성은 로컬 개발 미리보기에서만 켜집니다. 이 프로젝트의 영구 인증·사용량 제한이 준비되기 전까지 프로덕션에서는 안전상 비활성화됩니다.
        </p>
      )}
    </fieldset>
  );
}
