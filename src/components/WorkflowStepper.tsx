"use client";

import { Check, Circle } from "lucide-react";
import { WORKFLOW_STEPS } from "@/types";
import type { ProjectStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_ORDER: ProjectStatus[] = [
  "draft",
  "script",
  "keyframes",
  "infographics",
  "videos",
  "audio",
  "editing",
  "complete",
];

interface WorkflowStepperProps {
  currentStatus: ProjectStatus;
  onStepClick?: (stepId: string) => void;
}

export function WorkflowStepper({
  currentStatus,
  onStepClick,
}: WorkflowStepperProps) {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);

  return (
    <div className="card p-6">
      <h3 className="mb-4 text-sm font-medium text-gray-400">제작 워크플로우</h3>
      <div className="space-y-1">
        {WORKFLOW_STEPS.map((step, i) => {
          const stepIndex = STATUS_ORDER.indexOf(step.id as ProjectStatus);
          const isComplete = currentIndex > stepIndex;
          const isCurrent = currentStatus === step.id;
          const isPending = currentIndex < stepIndex;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick?.(step.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                isCurrent && "bg-brand-600/20 ring-1 ring-brand-500/50",
                !isCurrent && "hover:bg-gray-800/50"
              )}
            >
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  isComplete && "bg-brand-600 text-white",
                  isCurrent && "bg-brand-500 text-white",
                  isPending && "bg-gray-800 text-gray-500"
                )}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  i + 1
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isCurrent ? "text-white" : isComplete ? "text-gray-300" : "text-gray-500"
                  )}
                >
                  {step.label}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {step.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
