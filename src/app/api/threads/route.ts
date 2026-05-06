import { NextRequest, NextResponse } from "next/server";
import { getThreads, saveThreads } from "@/shared/lib/data";
import { checkProjectAccess, denied } from "@/shared/lib/projectContext";

export async function GET(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);
  return NextResponse.json(getThreads(access.projectId));
}

export async function DELETE(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const projectId = access.projectId;
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    saveThreads(
      getThreads(projectId).filter((t) => t.id !== id),
      projectId,
    );
  } else {
    saveThreads([], projectId);
  }
  return NextResponse.json({ ok: true });
}
