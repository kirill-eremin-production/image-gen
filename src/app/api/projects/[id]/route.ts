import { NextRequest, NextResponse } from "next/server";
import { getProjects, saveProjects, hashPassword } from "@/shared/lib/data";
import { addUnlocked } from "@/shared/lib/projectContext";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const projects = getProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (typeof body.name === "string") project.name = body.name;
  if (typeof body.icon === "string") project.icon = body.icon;
  if (typeof body.color === "string") project.color = body.color;

  let passwordJustSet = false;
  if (body.removePassword) {
    project.passwordHash = null;
  } else if (typeof body.password === "string" && body.password) {
    project.passwordHash = hashPassword(body.password);
    passwordJustSet = true;
  }

  saveProjects(projects);

  const res = NextResponse.json({
    id: project.id,
    name: project.name,
    icon: project.icon,
    color: project.color,
    hasPassword: !!project.passwordHash,
  });

  if (passwordJustSet) addUnlocked(req, res, project.id);
  return res;
}
