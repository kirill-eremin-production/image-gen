import {
  ImageFile,
  Thread,
  GenerateParams,
  ProjectInfo,
  SettingsState,
  PromptPresetCategory,
  PromptPresetScope,
} from "@/shared/types";

let _activeProjectId: string | null = null;

export function setActiveProjectId(id: string | null) {
  _activeProjectId = id;
}

function projectHeaders(projectId: string | null = _activeProjectId): HeadersInit {
  return projectId ? { "x-project-id": projectId } : {};
}

// --- Images ---

export function imageUrl(type: string, name: string) {
  const projectQuery = _activeProjectId ? `&project=${_activeProjectId}` : "";
  return `/api/view?type=${type}&name=${name}${projectQuery}`;
}

export async function fetchFiles(type: "references" | "generated" | "videos"): Promise<ImageFile[]> {
  const res = await fetch(`/api/files?type=${type}`, { headers: projectHeaders() });
  return res.json();
}

export async function deleteImage(type: string, name: string) {
  return fetch(`/api/delete?type=${type}&name=${name}`, {
    method: "DELETE",
    headers: projectHeaders(),
  });
}

export async function deleteAllImages(type: "references" | "generated" | "videos") {
  return fetch(`/api/delete?type=${type}&all=true`, {
    method: "DELETE",
    headers: projectHeaders(),
  });
}

export async function revealImage(type: string, name: string) {
  return fetch(`/api/reveal?type=${type}&name=${name}`, { headers: projectHeaders() });
}

// --- Threads ---

export async function fetchThreads(): Promise<Thread[]> {
  const res = await fetch("/api/threads", { headers: projectHeaders() });
  return res.json();
}

export async function deleteThread(id: string) {
  return fetch(`/api/threads?id=${id}`, { method: "DELETE", headers: projectHeaders() });
}

export async function clearAllThreads() {
  return fetch("/api/threads", { method: "DELETE", headers: projectHeaders() });
}

// --- Generate ---

export async function generateMedia(
  params: GenerateParams,
  projectId: string | null = _activeProjectId,
) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...projectHeaders(projectId) },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    const error = data.error || {};
    const message =
      (typeof error === "object" ? error.message : error) || "Ошибка генерации";
    const details = [String(message)];
    if (error.providerMessage && error.providerMessage !== message) {
      details.push(`Сообщение провайдера: ${error.providerMessage}`);
    }
    if (error.jobId) details.push(`ID задания: ${error.jobId}`);
    if (error.generationId) {
      details.push(`ID генерации: ${error.generationId}`);
    }
    throw new Error(details.join("\n"));
  }
  return data;
}

export const generateImage = generateMedia;

// --- Prompt presets ---

async function presetRequest(
  url: string,
  init?: RequestInit,
): Promise<PromptPresetCategory[]> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...projectHeaders(),
      ...init?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Не удалось сохранить пресеты.");
  return data;
}

export function fetchPromptPresets(): Promise<PromptPresetCategory[]> {
  return presetRequest("/api/presets");
}

export function createPromptPresetCategory(data: {
  name: string;
  scope: PromptPresetScope;
}) {
  return presetRequest("/api/presets", {
    method: "POST",
    body: JSON.stringify({ type: "category", ...data }),
  });
}

export function updatePromptPresetCategory(categoryId: string, name: string) {
  return presetRequest("/api/presets", {
    method: "PUT",
    body: JSON.stringify({ type: "category", categoryId, name }),
  });
}

export function deletePromptPresetCategory(categoryId: string) {
  return presetRequest(`/api/presets?categoryId=${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
  });
}

export function createPromptPresetVariant(
  categoryId: string,
  data: { name: string; prompt: string },
) {
  return presetRequest("/api/presets", {
    method: "POST",
    body: JSON.stringify({ type: "variant", categoryId, ...data }),
  });
}

export function updatePromptPresetVariant(
  categoryId: string,
  variantId: string,
  data: { name: string; prompt: string },
) {
  return presetRequest("/api/presets", {
    method: "PUT",
    body: JSON.stringify({
      type: "variant",
      categoryId,
      variantId,
      ...data,
    }),
  });
}

export function deletePromptPresetVariant(
  categoryId: string,
  variantId: string,
) {
  return presetRequest(
    `/api/presets?categoryId=${encodeURIComponent(categoryId)}&variantId=${encodeURIComponent(variantId)}`,
    { method: "DELETE" },
  );
}

// --- Settings (global) ---

export async function fetchSettings(): Promise<SettingsState> {
  const res = await fetch("/api/settings");
  return res.json();
}

// --- Projects ---

export async function fetchProjects(): Promise<ProjectInfo[]> {
  const res = await fetch("/api/projects");
  return res.json();
}

export async function createProject(data: {
  name: string;
  icon: string;
  color: string;
  password?: string;
}): Promise<ProjectInfo> {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateProject(
  id: string,
  data: { name?: string; icon?: string; color?: string; password?: string; removePassword?: boolean },
): Promise<ProjectInfo> {
  const res = await fetch(`/api/projects/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteProject(id: string) {
  return fetch(`/api/projects?id=${id}`, { method: "DELETE" });
}

export async function authProject(projectId: string, password: string): Promise<{ ok: boolean }> {
  const res = await fetch("/api/projects/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, password }),
  });
  return res.json();
}
