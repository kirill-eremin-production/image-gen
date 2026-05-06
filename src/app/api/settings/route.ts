import { NextRequest, NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/shared/lib/data";

export async function GET() {
  const settings = getSettings();
  const envKey = process.env.OPENROUTER_API_KEY;

  return NextResponse.json({
    hasOpenrouterApiKey: Boolean(settings.openrouterApiKey || envKey),
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const settings = getSettings();

  if (typeof body.openrouterApiKey === "string") {
    settings.openrouterApiKey = body.openrouterApiKey.trim();
  }

  saveSettings(settings);
  return NextResponse.json({ ok: true });
}
