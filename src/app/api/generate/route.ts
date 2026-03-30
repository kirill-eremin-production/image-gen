import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ensureDirs,
  getRefsDir,
  getGensDir,
  getThreads,
  saveThreads,
  saveBase64Image,
  resolveDir,
  getSettings,
} from "@/shared/lib/data";

const MODELS: Record<string, string> = {
  "gemini-3-pro": "google/gemini-3-pro-image-preview",
  "gemini-3.1-flash": "google/gemini-3.1-flash-image-preview",
};

const DEFAULT_MODEL = "gemini-3.1-flash";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function POST(req: NextRequest) {
  const projectId = req.headers.get("x-project-id") || null;
  ensureDirs(projectId);

  const { prompt, resolution, aspectRatio, references, threadId, model } =
    await req.json();

  const refsDir = getRefsDir(projectId);
  const gensDir = getGensDir(projectId);

  const selectedModel = MODELS[model] || MODELS[DEFAULT_MODEL];
  const content: Array<Record<string, unknown>> = [];

  if (references && Array.isArray(references)) {
    for (const ref of references) {
      let base64Data = ref;

      if (ref.startsWith("/api/view")) {
        const refUrl = new URL(ref, "http://localhost");
        const type = refUrl.searchParams.get("type") || "generated";
        const name = refUrl.searchParams.get("name");
        if (!name) continue;

        const dir = resolveDir(type, projectId);
        const filePath = path.join(dir, path.basename(name));
        if (!fs.existsSync(filePath)) continue;

        const fileData = fs.readFileSync(filePath);
        const ext = path.extname(name).replace(".", "") || "png";
        base64Data = `data:image/${ext};base64,${fileData.toString("base64")}`;
      } else if (ref.startsWith("data:image")) {
        saveBase64Image(ref, refsDir, "ref");
      }

      content.push({
        type: "image_url",
        image_url: { url: base64Data },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  const payload = {
    model: selectedModel,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    image_config: { image_size: resolution, aspect_ratio: aspectRatio },
  };

  const settings = getSettings();
  const apiKey = settings.openrouterApiKey || process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "API ключ не настроен. Укажите ключ OpenRouter в настройках." },
      { status: 400 },
    );
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  const savedImages: Array<{ name: string; url: string }> = [];

  if (result.choices?.[0]?.message?.images) {
    for (const img of result.choices[0].message.images) {
      if (img.image_url?.url?.startsWith("data:image")) {
        const filename = saveBase64Image(img.image_url.url, gensDir, "gen");
        if (filename) {
          savedImages.push({
            name: filename,
            url: `/api/view?type=generated&name=${filename}`,
          });
        }
      }
    }
  }

  const threads = getThreads(projectId);
  let currentThread = threadId
    ? threads.find((t) => t.id === threadId)
    : undefined;

  if (!currentThread) {
    currentThread = {
      id: Date.now().toString(),
      title: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
      history: [],
    };
    threads.push(currentThread);
  }

  const cost = result.usage?.cost != null ? result.usage.cost : null;

  currentThread.history.push({
    timestamp: new Date().toISOString(),
    prompt,
    resolution,
    aspectRatio,
    images: savedImages,
    cost,
  });

  saveThreads(threads, projectId);
  result.threadId = currentThread.id;

  return NextResponse.json(result);
}
