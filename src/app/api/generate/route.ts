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
  saveBase64ImageOnce,
  resolveDir,
  getSettings,
} from "@/shared/lib/data";
import { checkProjectAccess, denied } from "@/shared/lib/projectContext";
import { IMAGE_MODELS, VIDEO_MODELS } from "@/shared/config";
import {
  GenerateParams,
  GenerationReference,
  GenerationReferenceRole,
  ImageFile,
  Thread,
} from "@/shared/types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1";
const MAX_REFERENCES = 14;
const DEFAULT_IMAGE_VARIANTS = 2;
const MAX_IMAGE_VARIANTS = 10;

interface VideoJob {
  id: string;
  generation_id?: string;
  polling_url?: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "expired";
  error?: unknown;
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

function providerErrorText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const parts = [
    record.message,
    record.detail,
    record.reason,
    record.code,
    record.filter_reason,
    record.finish_reason,
  ]
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  if (parts.length > 0) return [...new Set(parts)].join(" · ");
  if (record.error && record.error !== value) return providerErrorText(record.error);
  return "";
}

function videoErrorResponse({
  job,
  providerMessage,
  code,
  fallbackMessage,
  status = 422,
}: {
  job: VideoJob;
  providerMessage?: string;
  code: string;
  fallbackMessage: string;
  status?: number;
}) {
  const jobRecord = job as unknown as Record<string, unknown>;
  const originalMessage = [
    providerMessage?.trim(),
    providerErrorText(job.error),
    providerErrorText(jobRecord.provider_error),
    providerErrorText(jobRecord.status_reason),
    providerErrorText(jobRecord.moderation),
  ]
    .filter((item): item is string => Boolean(item))
    .filter((item, index, items) => items.indexOf(item) === index)
    .join(" · ");
  const looksFiltered = /filter|safety|content policy|no output/i.test(
    originalMessage,
  );
  const message = looksFiltered
    ? "Видео не создано: провайдер завершил генерацию без результата. Скорее всего, prompt или референс был отклонён фильтром безопасности."
    : fallbackMessage;

  return NextResponse.json(
    {
      error: {
        message,
        code,
        providerMessage: originalMessage || undefined,
        jobId: job.id,
        generationId: job.generation_id,
      },
    },
    { status },
  );
}

async function parseOpenRouterError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as Record<string, unknown>;
    return (
      providerErrorText(body.error) ||
      providerErrorText(body) ||
      JSON.stringify(body)
    );
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
  params: GenerateParams,
  projectId: string | null,
  refsDir: string,
) {
  const prepared: string[] = [];
  const files: GenerationReference[] = [];
  const references = params.references || [];

  function roleForIndex(index: number): GenerationReferenceRole {
    if (params.mediaType === "video" && params.referenceMode === "frames") {
      return index === 0 ? "first_frame" : "last_frame";
    }
    return index === 0 ? "primary" : "secondary";
  }

  for (const [index, reference] of references.slice(0, MAX_REFERENCES).entries()) {
    let value = reference;
    const role = roleForIndex(index);

    if (reference.startsWith("/api/view")) {
      const refUrl = new URL(reference, "http://localhost");
      const type = refUrl.searchParams.get("type") || "generated";
      const name = refUrl.searchParams.get("name");
      if (!name) continue;

      const filePath = path.join(resolveDir(type, projectId), path.basename(name));
      if (!fs.existsSync(filePath)) continue;

      const fileData = fs.readFileSync(filePath);
      value = `data:${mimeType(name)};base64,${fileData.toString("base64")}`;
      const projectQuery = projectId ? `&project=${projectId}` : "";
      files.push({
        name: path.basename(name),
        url: `/api/view?type=${type}&name=${encodeURIComponent(path.basename(name))}${projectQuery}`,
        type: type === "references" ? "references" : "generated",
        source: "library",
        order: index,
        role,
      });
    } else if (reference.startsWith("data:image")) {
      if (params.saveReferences !== false) {
        const filename = params.generationBatchId
          ? saveBase64ImageOnce(
              reference,
              refsDir,
              `ref_${params.generationBatchId}_${index}`,
            )
          : saveBase64Image(reference, refsDir, "ref");
        if (filename) {
          const projectQuery = projectId ? `&project=${projectId}` : "";
          files.push({
            name: filename,
            url: `/api/view?type=references&name=${encodeURIComponent(filename)}${projectQuery}`,
            type: "references",
            source: "upload",
            order: index,
            role,
          });
        }
      }
    } else if (/^https?:\/\//i.test(reference)) {
      files.push({
        name: `reference_${index + 1}`,
        url: reference,
        type: "external",
        source: "external",
        order: index,
        role,
      });
    } else if (!/^https?:\/\//i.test(reference)) {
      continue;
    }

    prepared.push(value);
  }

  return { prepared, files };
}

function getOrCreateThread(threads: Thread[], threadId: string | null, prompt: string) {
  let thread = threadId ? threads.find((item) => item.id === threadId) : undefined;
  if (!thread) {
    thread = {
      id: threadId || Date.now().toString(),
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
    params.mediaType === "image" &&
    params.variantCount != null &&
    (!Number.isInteger(params.variantCount) ||
      params.variantCount < 1 ||
      params.variantCount > MAX_IMAGE_VARIANTS)
  ) {
    return `Количество вариантов должно быть целым числом от 1 до ${MAX_IMAGE_VARIANTS}.`;
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
  const { prepared: references, files: referenceFiles } = prepareReferences(
    params,
    projectId,
    refsDir,
  );
  const content: Array<Record<string, unknown>> = references.map((url) => ({
    type: "image_url",
    image_url: { url },
  }));
  content.push({ type: "text", text: params.prompt.trim() });
  const variantCount = params.variantCount ?? DEFAULT_IMAGE_VARIANTS;
  const requestBody = JSON.stringify({
    model: params.model,
    messages: [{ role: "user", content }],
    modalities: ["image", "text"],
    image_config: {
      image_size: params.resolution,
      aspect_ratio: params.aspectRatio,
    },
  });
  const variants = await Promise.allSettled(
    Array.from({ length: variantCount }, async () => {
      const response = await fetch(`${OPENROUTER_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });

      if (!response.ok) {
        throw new Error(await parseOpenRouterError(response));
      }
      return response.json();
    }),
  );

  const savedImages: ImageFile[] = [];
  let cost = 0;
  let hasCost = false;
  const errors: string[] = [];

  for (const variant of variants) {
    if (variant.status === "rejected") {
      errors.push(
        variant.reason instanceof Error ? variant.reason.message : "Ошибка генерации варианта.",
      );
      continue;
    }

    const result = variant.value;
    const variantImages = result.choices?.[0]?.message?.images || [];
    let savedVariant = false;
    for (const image of variantImages) {
      if (!image.image_url?.url?.startsWith("data:image")) continue;
      const filename = saveBase64Image(image.image_url.url, gensDir, "gen");
      if (!filename) continue;
      const projectQuery = projectId ? `&project=${projectId}` : "";
      savedImages.push({
        name: filename,
        url: `/api/view?type=generated&name=${filename}${projectQuery}`,
        kind: "image",
      });
      savedVariant = true;
    }
    if (!savedVariant) {
      errors.push(result.error?.message || "OpenRouter не вернул изображение.");
    }
    if (result.usage?.cost != null) {
      cost += Number(result.usage.cost);
      hasCost = true;
    }
  }

  if (savedImages.length === 0) {
    return errorResponse(errors[0] || "OpenRouter не вернул изображения.", 502);
  }

  const threads = getThreads(projectId);
  const thread = getOrCreateThread(threads, params.threadId, params.prompt);
  const totalCost = hasCost ? cost : null;
  const batchEntry = params.generationBatchId
    ? thread.history.find(
        (entry) => entry.generationBatchId === params.generationBatchId,
      )
    : undefined;

  if (batchEntry) {
    batchEntry.images.push(...savedImages);
    const referencesByOrder = new Map(
      (batchEntry.references || []).map((reference) => [reference.order, reference]),
    );
    for (const reference of referenceFiles) {
      referencesByOrder.set(reference.order, reference);
    }
    batchEntry.references = [...referencesByOrder.values()].sort(
      (a, b) => a.order - b.order,
    );
    if (totalCost != null) {
      batchEntry.cost = (batchEntry.cost || 0) + totalCost;
    }
  } else {
    thread.history.push({
      timestamp: params.submittedAt || new Date().toISOString(),
      prompt: params.prompt,
      resolution: params.resolution,
      aspectRatio: params.aspectRatio,
      images: savedImages,
      videos: [],
      mediaType: "image",
      model: params.model,
      generationBatchId: params.generationBatchId,
      references: referenceFiles,
      cost: totalCost,
    });
  }
  thread.history.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  saveThreads(threads, projectId);

  return NextResponse.json({
    status: "completed",
    mediaType: "image",
    files: savedImages,
    cost: totalCost,
    requestedCount: variantCount,
    completedCount: variants.length - errors.length,
    failedCount: errors.length,
    threadId: thread.id,
  });
}

async function submitVideo(
  params: GenerateParams,
  projectId: string | null,
  key: string,
) {
  const { prepared: references, files: referenceFiles } = prepareReferences(
    params,
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
  return NextResponse.json({ ...job, referenceFiles }, { status: 202 });
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
  if (job.status === "failed") {
    return videoErrorResponse({
      job,
      code: "VIDEO_GENERATION_FAILED",
      fallbackMessage: "Провайдер не смог сгенерировать видео.",
    });
  }
  if (job.status === "cancelled") {
    return videoErrorResponse({
      job,
      code: "VIDEO_GENERATION_CANCELLED",
      fallbackMessage: "Провайдер отменил задание генерации видео.",
    });
  }
  if (job.status === "expired") {
    return videoErrorResponse({
      job,
      code: "VIDEO_GENERATION_EXPIRED",
      fallbackMessage: "Время хранения задания истекло до получения видео.",
    });
  }
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
      return videoErrorResponse({
        job,
        providerMessage: await parseOpenRouterError(downloadResponse),
        code: "VIDEO_NO_OUTPUT",
        fallbackMessage:
          "Генерация завершилась, но провайдер не вернул видеофайл.",
        status: downloadResponse.status >= 500 ? 502 : 422,
      });
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
      timestamp: params.submittedAt || new Date().toISOString(),
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
      references: params.referenceFiles || [],
      cost,
    });
    thread.history.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
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
