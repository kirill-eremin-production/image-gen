import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  Thread,
  Settings,
  Project,
  PromptPresetCategory,
  PromptPresetScope,
} from "@/shared/types";

const DATA_DIR =
  process.env.DATA_DIR ||
  path.join(/* turbopackIgnore: true */ process.cwd(), "data");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const GLOBAL_PROMPT_PRESETS_FILE = path.join(DATA_DIR, "prompt-presets.json");

function projectBase(projectId?: string | null): string {
  return projectId ? path.join(PROJECTS_DIR, projectId) : DATA_DIR;
}

export function getRefsDir(projectId?: string | null) {
  return path.join(projectBase(projectId), "references");
}

export function getGensDir(projectId?: string | null) {
  return path.join(projectBase(projectId), "generated");
}

export function getVideosDir(projectId?: string | null) {
  return path.join(projectBase(projectId), "videos");
}

export function getThreadsFile(projectId?: string | null) {
  return path.join(projectBase(projectId), "threads.json");
}

function getPromptPresetsFile(
  scope: PromptPresetScope,
  projectId?: string | null,
) {
  return scope === "global"
    ? GLOBAL_PROMPT_PRESETS_FILE
    : path.join(projectBase(projectId), "prompt-presets.json");
}

// Backward-compat exports for code that doesn't need project scope
export const REFS_DIR = getRefsDir();
export const GENS_DIR = getGensDir();
export const VIDEOS_DIR = getVideosDir();
export const THREADS_FILE = getThreadsFile();

export function ensureDirs(projectId?: string | null) {
  const base = projectBase(projectId);
  const refs = getRefsDir(projectId);
  const gens = getGensDir(projectId);
  const videos = getVideosDir(projectId);
  const threadsFile = getThreadsFile(projectId);

  [base, refs, gens, videos].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(threadsFile)) {
    fs.writeFileSync(threadsFile, JSON.stringify([]));
  }
}

export function resolveDir(type: string, projectId?: string | null) {
  if (type === "references") return getRefsDir(projectId);
  if (type === "videos") return getVideosDir(projectId);
  return getGensDir(projectId);
}

// --- Threads ---

export function getThreads(projectId?: string | null): Thread[] {
  ensureDirs(projectId);
  try {
    return JSON.parse(fs.readFileSync(getThreadsFile(projectId), "utf8"));
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[], projectId?: string | null) {
  ensureDirs(projectId);
  fs.writeFileSync(getThreadsFile(projectId), JSON.stringify(threads, null, 2));
}

// --- Images ---

export function saveBase64Image(base64String: string, directory: string, prefix: string): string | null {
  const matches = base64String.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;

  const extension = matches[1];
  const data = matches[2];
  const buffer = Buffer.from(data, "base64");
  const filename = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${extension}`;
  const filePath = path.join(directory, filename);

  fs.writeFileSync(filePath, buffer);
  return filename;
}

// --- Settings (global) ---

const DEFAULT_SETTINGS: Settings = {
  openrouterApiKey: "",
};

export function getSettings(): Settings {
  ensureDirs();
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8")) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings) {
  ensureDirs();
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// --- Prompt presets ---

export function getPromptPresetCategories(
  scope: PromptPresetScope,
  projectId?: string | null,
): PromptPresetCategory[] {
  if (scope === "project" && !projectId) return [];
  ensureDirs(scope === "project" ? projectId : null);

  try {
    const parsed = JSON.parse(
      fs.readFileSync(getPromptPresetsFile(scope, projectId), "utf8"),
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePromptPresetCategories(
  scope: PromptPresetScope,
  categories: PromptPresetCategory[],
  projectId?: string | null,
) {
  if (scope === "project" && !projectId) {
    throw new Error("Для проектных пресетов нужен проект.");
  }
  ensureDirs(scope === "project" ? projectId : null);
  fs.writeFileSync(
    getPromptPresetsFile(scope, projectId),
    JSON.stringify(categories, null, 2),
  );
}

// --- Projects ---

export function getProjects(): Project[] {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

export function saveProjects(projects: Project[]) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

export function deleteProjectData(projectId: string) {
  const dir = path.join(PROJECTS_DIR, projectId);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
}

// --- Password ---

export function hashPassword(pw: string): string {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

export function verifyPassword(pw: string, hash: string): boolean {
  return hashPassword(pw) === hash;
}
