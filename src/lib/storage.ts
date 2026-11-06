import { v4 as uuidv4 } from "uuid";
import type { Project, ProjectStatus } from "@/types";
import { generateKeyframes } from "./prompt-generator";

const STORAGE_KEY = "shortsmaking_projects";

function loadProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveProjects(projects: Project[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function getAllProjects(): Project[] {
  return loadProjects().sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function getProject(id: string): Project | null {
  return loadProjects().find((p) => p.id === id) ?? null;
}

export function createProject(data: {
  title: string;
  topic: string;
  script: string;
  audioDurationSec: number;
}): Project {
  const now = new Date().toISOString();
  const keyframes = generateKeyframes(
    data.script,
    data.audioDurationSec,
    data.topic
  );

  const project: Project = {
    id: uuidv4(),
    title: data.title,
    topic: data.topic,
    script: data.script,
    audioDurationSec: data.audioDurationSec,
    status: "keyframes",
    keyframes,
    createdAt: now,
    updatedAt: now,
  };

  const projects = loadProjects();
  projects.push(project);
  saveProjects(projects);
  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Project>
): Project | null {
  const projects = loadProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveProjects(projects);
  return projects[index];
}

export function deleteProject(id: string): boolean {
  const projects = loadProjects().filter((p) => p.id !== id);
  if (projects.length === loadProjects().length) return false;
  saveProjects(projects);
  return true;
}

export function updateProjectStatus(
  id: string,
  status: ProjectStatus
): Project | null {
  return updateProject(id, { status });
}

export function regenerateKeyframes(id: string): Project | null {
  const project = getProject(id);
  if (!project) return null;

  const keyframes = generateKeyframes(
    project.script,
    project.audioDurationSec,
    project.topic
  );
  return updateProject(id, { keyframes });
}

export function renameClipFiles(
  id: string,
  fileNames: string[]
): Project | null {
  const project = getProject(id);
  if (!project) return null;

  const keyframes = project.keyframes.map((kf, i) => ({
    ...kf,
    clipFileName: fileNames[i]
      ? `${String(i + 1).padStart(2, "0")}_${fileNames[i]}`
      : `${String(i + 1).padStart(2, "0")}_clip.mp4`,
  }));

  return updateProject(id, { keyframes });
}
