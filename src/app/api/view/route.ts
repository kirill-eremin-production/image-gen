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
  const contentTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
  };
  const contentType = contentTypes[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);
  const range = req.headers.get("range");

  if (range && contentType.startsWith("video/")) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (!match) return new NextResponse(null, { status: 416 });

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }

    const length = end - start + 1;
    const file = fs.openSync(filePath, "r");
    const chunk = Buffer.alloc(length);
    fs.readSync(file, chunk, 0, length, start);
    fs.closeSync(file);

    return new NextResponse(chunk, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": length.toString(),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }

  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": stat.size.toString(),
      "Accept-Ranges": "bytes",
    },
  });
}
