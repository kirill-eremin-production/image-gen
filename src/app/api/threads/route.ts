import { NextRequest, NextResponse } from "next/server";
import { getThreads, saveThreads } from "@/shared/lib/data";

export async function GET(req: NextRequest) {
  const projectId = req.headers.get("x-project-id") || null;
  return NextResponse.json(getThreads(projectId));
}

export async function DELETE(req: NextRequest) {
  const projectId = req.headers.get("x-project-id") || null;
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
