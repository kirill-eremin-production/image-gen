import { NextRequest, NextResponse } from "next/server";
import {
  getProjects,
  saveProjects,
  ensureDirs,
  deleteProjectData,
  hashPassword,
} from "@/shared/lib/data";
import { addUnlocked } from "@/shared/lib/projectContext";
import { Project, ProjectInfo } from "@/shared/types";

function toInfo(p: Project): ProjectInfo {
  return {
    id: p.id,
    name: p.name,
    icon: p.icon,
    color: p.color,
    hasPassword: !!p.passwordHash,
  };
}

export async function GET() {
  return NextResponse.json(getProjects().map(toInfo));
}

export async function POST(req: NextRequest) {
  const { name, icon, color, password } = await req.json();

  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);

  const project: Project = {
    id,
    name,
    icon: icon || "📁",
    color: color || "#3b82f6",
    passwordHash: password ? hashPassword(password) : null,
  };

  const projects = getProjects();
  projects.push(project);
  saveProjects(projects);
  ensureDirs(id);

  const res = NextResponse.json(toInfo(project));
  if (project.passwordHash) addUnlocked(req, res, project.id);
  return res;
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return new NextResponse(null, { status: 400 });

  const projects = getProjects().filter((p) => p.id !== id);
  saveProjects(projects);
  deleteProjectData(id);

  return NextResponse.json({ ok: true });
}
