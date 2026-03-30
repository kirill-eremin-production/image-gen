import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { ensureDirs, resolveDir } from "@/shared/lib/data";

export async function GET(req: NextRequest) {
  const projectId = req.headers.get("x-project-id") || null;
  ensureDirs(projectId);
  const type = req.nextUrl.searchParams.get("type") || "generated";
  const dir = resolveDir(type, projectId);

  if (!fs.existsSync(dir)) {
    return NextResponse.json([]);
  }

  const files = fs
    .readdirSync(dir)
    .filter((file) => /\.(png|jpg|jpeg|gif|webp)$/i.test(file))
    .map((file) => ({
      name: file,
      url: `/api/view?type=${type}&name=${file}`,
    }));

  return NextResponse.json(files);
}
