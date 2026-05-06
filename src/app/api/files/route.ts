import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ensureDirs, resolveDir } from "@/shared/lib/data";
import { checkProjectAccess, denied } from "@/shared/lib/projectContext";

export async function GET(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const projectId = access.projectId;
  ensureDirs(projectId);
  const type = req.nextUrl.searchParams.get("type") || "generated";
  const dir = resolveDir(type, projectId);

  if (!fs.existsSync(dir)) {
    return NextResponse.json([]);
  }

  const projectQuery = projectId ? `&project=${projectId}` : "";
  const files = fs
    .readdirSync(dir)
    .filter((file) => /\.(png|jpg|jpeg|gif|webp)$/i.test(file))
    .map((file) => ({
      name: file,
      url: `/api/view?type=${type}&name=${file}${projectQuery}`,
    }));

  return NextResponse.json(files);
}
