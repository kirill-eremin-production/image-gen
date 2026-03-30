import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { ensureDirs, resolveDir } from "@/shared/lib/data";

export async function GET(req: NextRequest) {
  const projectId = req.headers.get("x-project-id") || null;
  ensureDirs(projectId);
  const type = req.nextUrl.searchParams.get("type") || "generated";
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return new NextResponse(null, { status: 400 });

  const dir = resolveDir(type, projectId);
  const filePath = path.join(dir, path.basename(name));

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }

  const command =
    process.platform === "win32"
      ? `explorer /select,"${filePath}"`
      : `open -R "${filePath}"`;

  return new Promise<NextResponse>((resolve) => {
    exec(command, (error) => {
      if (error) {
        resolve(NextResponse.json({ error: error.message }, { status: 500 }));
      } else {
        resolve(new NextResponse("OK"));
      }
    });
  });
}
