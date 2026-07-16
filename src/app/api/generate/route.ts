import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import {
  ensureDirs,
  getRefsDir,
  getGensDir,
  getVideosDir,
  getThreads,
  saveThreads,
  saveBase64Image,
  resolveDir,
  getSettings,
} from "@/shared/lib/data";
import { checkProjectAccess, denied } from "@/shared/lib/projectContext";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/shared/config";
import { GenerateParams, ImageFile, Thread } from "@/shared/types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const MAX_REFERENCES = 14;

interface VideoJob {
  id: string;
  polling_url?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "expired";
  error?: string;
  unsigned_urls?: string[];
  usage?: { cost?: number };
}

function apiKey() {
  const settings = getSettings();
  return settings.openrouterApiKey || process.env.OPENROUTER_API_KEY || "";
}

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: { message } }, { status });
}

async function parseOpenRouterError(response: Response) {
  const text = await response.text();
  try {
    const body = JSON.parse(text);
    return body.error?.message || body.error || JSON.stringify(body);
  } catch {
    return text || `OpenRouter вернул ошибку ${response.status}.`;
  }
}

function mimeType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  return types[ext] || "image/png";
}

function prepareReferences(
  references: string[],
  projectId: string | null,
  refsDir: string,
) {
  const prepared: string[] = [];

  for (const reference of references.slice(0, MAX_REFERENCES)) {
    let value = reference;

    if (reference.startsWith("/api/view")) {
      const refUrl = new URL(reference, "http://localhost");
      const type = refUrl.searchParams.get("type") || "generated";
      const name = refUrl.searchParams.get("name");
      if (!name) continue;

      const filePath = path.join(resolveDir(type, projectId), path.basename(name));
      if (!fs.existsSync(filePath)) continue;

      const fileData = fs.readFileSync(filePath);
      value = `data:${mimeType(name)};base64,${fileData.toString("base64")}`;
    } else if (reference.startsWith("data:image")) {
      saveBase64Image(reference, refsDir, "ref");
    } else if (!/^https?:\/\//i.test(reference)) {
      continue;
    }

    prepared.push(value);
  }

  return prepared;
}

function getOrCreateThread(threads: Thread[], threadId: string | null, prompt: string) {
  let thread = threadId ? threads.find((item) => item.id === threadId) : undefined;
  if (!thread) {
    thread = {
      id: Date.now().toString(),
      title: prompt.substring(0, 30) + (prompt.length > 30 ? "..." : ""),
      history: [],
    };
    threads.push(thread);
  }
  return thread;
}

function validateParams(params: GenerateParams) {
  if (!params.prompt?.trim()) return "Введите описание.";

  const models = params.mediaType === "video" ? VIDEO_MODELS : IMAGE_MODELS;
  const model = models.find((item) => item.value === params.model);
  if (!model) return "Выбрана неподдерживаемая модель.";
  if (!model.resolutions.includes(params.resolution)) {
    return `Модель не поддерживает разрешение ${params.resolution}.`;
  }
  if (!model.aspectRatios.includes(params.aspectRatio)) {
    return `Модель не поддерживает формат ${params.aspectRatio}.`;
  }
  if (
    params.mediaType === "video" &&
    (!params.duration || !model.durations?.includes(params.duration))
  ) {
    return "Модель не поддерживает выбранную длительность.";
  }
  if ((params.references?.length || 0) > MAX_REFERENCES) {
    return `Можно использовать не более ${MAX_REFERENCES} референсов.`;
  }
  if (params.referenceMode === "frames" && (params.references?.length || 0) > 2) {
    return "Для первого и последнего кадра можно использовать не более двух изображений.";
  }
  if (
    params.seed != null &&
    (!Number.isInteger(params.seed) || Number(params.seed) < 0)
  ) {
    return "Seed должен быть целым неотрицательным числом.";
  }
  return null;
}

async function generateImage(
  params: GenerateParams,
  projectId: string | null,
  key: string,
) {
  const refsDir = getRefsDir(projectId);
  const gensDir = getGensDir(projectId);
  const references = prepareReferences(params.references || [], projectId, refsDir);
  const content: Array<Record<string, unknown>> = references.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));
  content.push({ type: "text", text: params.prompt.trim() });

  const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.model,
      messages: [{ role: "user", content }],
      modalities: ["image", "text"],
      image_config: {
        image_size: params.resolution,
        aspect_ratio: params.aspectRatio,
      },
    }),
  });

  if (!response.ok) {
    return errorResponse(await parseOpenRouterError(response), response.status);
  }

  const result = await response.json();
  const savedImages: ImageFile[] = [];

  for (const image of result.choices?.[0]?.message?.images || []) {
    if (!image.image_url?.url?.startsWith("data:image")) continue;
    const filename = saveBase64Image(image.image_url.url, gensDir, "gen");
    if (!filename) continue;
    const projectQuery = projectId ? `&project=${projectId}` : "";
    savedImages.push({
      name: filename,
      url: `/api/view?type=generated&name=${filename}${projectQuery}`,
      kind: "image",
    });
  }

  if (savedImages.length === 0) {
    return errorResponse(result.error?.message || "OpenRouter не вернул изображение.", 502);
  }

  const threads = getThreads(projectId);
  const thread = getOrCreateThread(threads, params.threadId, params.prompt);
  const cost = result.usage?.cost ?? null;
  thread.history.push({
    timestamp: new Date().toISOString(),
    prompt: params.prompt,
    resolution: params.resolution,
    aspectRatio: params.aspectRatio,
    images: savedImages,
    videos: [],
    mediaType: "image",
    model: params.model,
    cost,
  });
  saveThreads(threads, projectId);

  return NextResponse.json({
    status: "completed",
    mediaType: "image",
    files: savedImages,
    cost,
    threadId: thread.id,
  });
}

async function submitVideo(
  params: GenerateParams,
  projectId: string | null,
  key: string,
) {
  const references = prepareReferences(
    params.references || [],
    projectId,
    getRefsDir(projectId),
  );
  const imageParts = references.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));

  const payload: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt.trim(),
    duration: params.duration,
    resolution: params.resolution,
    aspect_ratio: params.aspectRatio,
    generate_audio: params.generateAudio ?? true,
  };

  if (Number.isInteger(params.seed) && Number(params.seed) >= 0) {
    payload.seed = params.seed;
  }
  if (imageParts.length > 0) {
    if (params.referenceMode === "frames") {
      payload.frame_images = imageParts.slice(0, 2).map((part, index) => ({
        ...part,
        frame_type: index === 0 ? "first_frame" : "last_frame",
      }));
    } else {
      payload.input_references = imageParts;
    }
  }

  const googleParameters: Record<string, unknown> = {};
  if (params.negativePrompt) googleParameters.negativePrompt = params.negativePrompt;
  if (params.enhancePrompt != null) googleParameters.enhancePrompt = params.enhancePrompt;
  if (Object.keys(googleParameters).length > 0) {
    payload.provider = {
      options: {
        "google-vertex": { parameters: googleParameters },
      },
    };
  }

  const response = await fetch(`${OPENROUTER_API_URL}/videos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    return errorResponse(await parseOpenRouterError(response), response.status);
  }

  const job = (await response.json()) as VideoJob;
  return NextResponse.json(job, { status: 202 });
}

async function pollVideo(
  params: GenerateParams,
  projectId: string | null,
  key: string,
) {
  if (!params.jobId) return errorResponse("Не указан идентификатор видео-задания.");

  const statusResponse = await fetch(
    `${OPENROUTER_API_URL}/videos/${encodeURIComponent(params.jobId)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  if (!statusResponse.ok) {
    return errorResponse(await parseOpenRouterError(statusResponse), statusResponse.status);
  }

  const job = (await statusResponse.json()) as VideoJob;
  if (job.status !== "completed") return NextResponse.json(job);

  const videosDir = getVideosDir(projectId);
  const safeJobId = params.jobId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `video_${safeJobId}.mp4`;
  const filePath = path.join(videosDir, filename);

  if (!fs.existsSync(filePath)) {
    const downloadResponse = await fetch(
      `${OPENROUTER_API_URL}/videos/${encodeURIComponent(params.jobId)}/content?index=0`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    if (!downloadResponse.ok) {
      return errorResponse(await parseOpenRouterError(downloadResponse), downloadResponse.status);
    }
    fs.writeFileSync(filePath, Buffer.from(await downloadResponse.arrayBuffer()));
  }

  const projectQuery = projectId ? `&project=${projectId}` : "";
  const video: ImageFile = {
    name: filename,
    url: `/api/view?type=videos&name=${filename}${projectQuery}`,
    kind: "video",
  };
  const threads = getThreads(projectId);
  const existingThread = threads.find((item) =>
    item.history.some((entry) => entry.videoJobId === params.jobId),
  );
  const thread =
    existingThread || getOrCreateThread(threads, params.threadId, params.prompt);
  const alreadySaved = thread.history.some((entry) => entry.videoJobId === params.jobId);
  const cost = job.usage?.cost ?? null;

  if (!alreadySaved) {
    thread.history.push({
      timestamp: new Date().toISOString(),
      prompt: params.prompt,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      images: [],
      videos: [video],
      mediaType: "video",
      model: params.model,
      duration: params.duration,
      generateAudio: params.generateAudio ?? true,
      seed: params.seed ?? null,
      negativePrompt: params.negativePrompt,
      videoJobId: params.jobId,
      cost,
    });
    saveThreads(threads, projectId);
  }

  return NextResponse.json({
    ...job,
    status: "completed",
    mediaType: "video",
    files: [video],
    cost,
    threadId: thread.id,
  });
}

export async function POST(req: NextRequest) {
  const access = checkProjectAccess(req);
  if (!access.ok) return denied(access);

  const projectId = access.projectId;
  ensureDirs(projectId);
  const key = apiKey();
  if (!key) {
    return errorResponse("API ключ не настроен. Укажите ключ OpenRouter в настройках.");
  }

  try {
    const params = (await req.json()) as GenerateParams;
    const validationError = validateParams(params);
    if (validationError) return errorResponse(validationError);

    if (params.mediaType === "video") {
      return params.action === "poll"
        ? await pollVideo(params, projectId, key)
        : await submitVideo(params, projectId, key);
    }
    return await generateImage(params, projectId, key);
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Не удалось выполнить генерацию.",
      500,
    );
  }
}
