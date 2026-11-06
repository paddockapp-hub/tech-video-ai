"use client";

import Link from "next/link";
import { Clock, Film, Trash2 } from "lucide-react";
import type { Project } from "@/types";
import { formatDuration } from "@/lib/timing";
import { deleteProject } from "@/lib/storage";

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  script: "대본 작성",
  keyframes: "키프레임",
  infographics: "인포그래픽",
  videos: "영상 생성",
  audio: "음성 생성",
  editing: "편집 중",
  complete: "완료",
};

interface ProjectCardProps {
  project: Project;
  onDelete: () => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    if (confirm("이 프로젝트를 삭제하시겠습니까?")) {
      deleteProject(project.id);
      onDelete();
    }
  }

  return (
    <Link
      href={`/project/${project.id}`}
      className="card group block p-5 transition hover:border-brand-600/50 hover:bg-gray-900"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/20">
          <Film className="h-5 w-5 text-brand-400" />
        </div>
        <button
          onClick={handleDelete}
          className="rounded p-1.5 text-gray-600 opacity-0 transition hover:bg-gray-800 hover:text-red-400 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <h3 className="mb-1 font-semibold text-white group-hover:text-brand-300">
        {project.title}
      </h3>
      <p className="mb-3 line-clamp-2 text-sm text-gray-500">{project.topic}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-full bg-gray-800 px-2.5 py-1 text-gray-400">
          {STATUS_LABELS[project.status] || project.status}
        </span>
        <span className="flex items-center gap-1 text-gray-500">
          <Clock className="h-3 w-3" />
          {formatDuration(project.audioDurationSec)}
        </span>
      </div>
    </Link>
  );
}
