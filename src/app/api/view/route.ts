import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDirs, resolveDir } from "@/shared/lib/data";
import { checkProjectAccess, denied } from "@/shared/lib/projectContext";

export async function GET(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const projectId = access.projectId;
  ensureDirs(projectId);
  const type = req.nextUrl.searchParams.get("type") || "generated";
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return new NextResponse(null, { status: 400 });

  const dir = resolveDir(type, projectId);
  const filePath = path.join(dir, path.basename(name));

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : "image/jpeg";
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType },
  });
}
