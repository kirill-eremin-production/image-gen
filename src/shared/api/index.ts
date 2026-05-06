import { ImageFile, Thread, GenerateParams, ProjectInfo } from "@/shared/types";

let _activeProjectId: string | null = null;

export function setActiveProjectId(id: string | null) {
  _activeProjectId = id;
}

function projectHeaders(): HeadersInit {
  return _activeProjectId ? { "x-project-id": _activeProjectId } : {};
}

// --- Images ---

export function imageUrl(type: string, name: string) {
  const projectQuery = _activeProjectId ? `&project=${_activeProjectId}` : "";
  return `/api/view?type=${type}&name=${name}${projectQuery}`;
}

export async function fetchFiles(type: "references" | "generated"): Promise<ImageFile[]> {
  const res = await fetch(`/api/files?type=${type}`, { headers: projectHeaders() });
  return res.json();
}

export async function deleteImage(type: string, name: string) {
  return fetch(`/api/delete?type=${type}&name=${name}`, {
    method: "DELETE",
    headers: projectHeaders(),
  });
}

export async function deleteAllImages(type: "references" | "generated") {
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

export async function generateImage(params: GenerateParams) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...projectHeaders() },
    body: JSON.stringify(params),
  });
  return res.json();
}

// --- Settings (global) ---

export async function fetchSettings(): Promise<{ openrouterApiKey: string }> {
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
