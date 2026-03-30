import { NextRequest, NextResponse } from "next/server";
import { getProjects, verifyPassword } from "@/shared/lib/data";

export async function POST(req: NextRequest) {
  const { projectId, password } = await req.json();

  const project = getProjects().find((p) => p.id === projectId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!project.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  if (verifyPassword(password || "", project.passwordHash)) {
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Неверный пароль" }, { status: 401 });
}
