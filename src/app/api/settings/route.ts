import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/shared/lib/data";

export async function GET() {
  const settings = getSettings();
  return NextResponse.json({
    openrouterApiKey: settings.openrouterApiKey || "",
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const settings = getSettings();

  if (typeof body.openrouterApiKey === "string") {
    settings.openrouterApiKey = body.openrouterApiKey;
  }

  saveSettings(settings);
  return NextResponse.json({ ok: true });
}
