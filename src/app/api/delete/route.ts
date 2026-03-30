import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureDirs, resolveDir } from "@/shared/lib/data";

export async function DELETE(req: NextRequest) {
  const projectId = req.headers.get("x-project-id") || null;
  ensureDirs(projectId);
  const type = req.nextUrl.searchParams.get("type") || "generated";
  const name = req.nextUrl.searchParams.get("name");
  const all = req.nextUrl.searchParams.get("all");

  const dir = resolveDir(type, projectId);

  // Delete all files of a given type
  if (all === "true") {
    if (!fs.existsSync(dir)) return NextResponse.json({ ok: true });
    const files = fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
    for (const file of files) {
      fs.unlinkSync(path.join(dir, file));
    }
    return NextResponse.json({ ok: true });
  }

  // Delete single file
  if (!name) return new NextResponse(null, { status: 400 });
  const filePath = path.join(dir, path.basename(name));

  if (!fs.existsSync(filePath)) {
    return new NextResponse(null, { status: 404 });
  }

  fs.unlinkSync(filePath);
  return new NextResponse("OK");
}
