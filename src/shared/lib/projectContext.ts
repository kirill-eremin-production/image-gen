import { NextRequest, NextResponse } from "next/server";
import { getProjects } from "./data";

export const UNLOCKED_COOKIE = "unlocked_projects";
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24h

function readUnlocked(req: NextRequest): Set<string> {
  const raw = req.cookies.get(UNLOCKED_COOKIE)?.value || "";
  return new Set(raw.split(",").filter(Boolean));
}

export function getProjectIdFromReq(req: NextRequest): string | null {
  // Header is used by fetch() in the API client.
  // Query param is used by <img src="/api/view?..."> tags, since browsers
  // don't attach custom headers to image requests.
  const header = req.headers.get("x-project-id");
  if (header) return header;
  const q = req.nextUrl.searchParams.get("project");
  return q || null;
}

export type ProjectAccess =
  | { ok: true; projectId: string | null }
  | { ok: false; status: number; reason: string };

export function checkProjectAccess(req: NextRequest): ProjectAccess {
  const projectId = getProjectIdFromReq(req);
  if (!projectId) return { ok: true, projectId: null };

  const project = getProjects().find((p) => p.id === projectId);
  if (!project) return { ok: false, status: 404, reason: "Project not found" };

  if (!project.passwordHash) return { ok: true, projectId };

  const unlocked = readUnlocked(req);
  if (!unlocked.has(projectId)) {
    return { ok: false, status: 403, reason: "Project is locked" };
  }
  return { ok: true, projectId };
}

export function denied(access: Extract<ProjectAccess, { ok: false }>): NextResponse {
  return NextResponse.json({ error: access.reason }, { status: access.status });
}

export function addUnlocked(req: NextRequest, res: NextResponse, projectId: string) {
  const set = readUnlocked(req);
  set.add(projectId);
  res.cookies.set(UNLOCKED_COOKIE, [...set].join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export function removeUnlocked(req: NextRequest, res: NextResponse, projectId: string) {
  const set = readUnlocked(req);
  if (!set.delete(projectId)) return;
  res.cookies.set(UNLOCKED_COOKIE, [...set].join(","), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}
