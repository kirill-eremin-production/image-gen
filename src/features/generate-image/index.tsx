"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Film, ImageIcon, Plus, Settings2, Sparkles } from "lucide-react";
import { IMAGE_MODELS, MediaType, VIDEO_MODELS } from "@/shared/config";
import { generateMedia } from "@/shared/api";
import { GenerateParams, HistoryEntry, PromptPresetCategory } from "@/shared/types";

export interface PendingGeneration {
  jobId: string;
  threadId: string;
  projectId: string | null;
  entry: HistoryEntry;
}

interface GenerateImageProps {
  selectedImages: Set<string>;
  projectId: string | null;
  currentThreadId: string | null;
  presetCategories: PromptPresetCategory[];
  onOpenPresets: () => void;
  onGenerationStarted: (data: PendingGeneration) => void;
  onGenerationProgress: (data: { jobId: string; progress: string }) => void;
  onGenerationVariantFinished: (data: { jobId: string; projectId: string | null }) => void | Promise<void>;
  onGenerationFinished: (data: { jobId: string; threadId: string; projectId: string | null; failedCount?: number }) => void;
  onGenerationFailed: (data: { jobId: string; error: string }) => void;
}

type Status = {
  type: "success" | "error" | "info";
  message: string;
};

const VIDEO_POLL_INTERVAL = 10_000;
const VIDEO_MAX_POLLS = 120;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatVariantCount(count: number) {
  const noun = count === 1 ? "вариант" : count < 5 ? "варианта" : "вариантов";
  return `${count} ${noun}`;
}

export function GenerateImage({
  selectedImages,
  projectId,
  currentThreadId,
  presetCategories,
  onOpenPresets,
  onGenerationStarted,
  onGenerationProgress,
  onGenerationVariantFinished,
  onGenerationFinished,
  onGenerationFailed,
}: GenerateImageProps) {
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(IMAGE_MODELS[0].value);
  const [resolution, setResolution] = useState("1K");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [variantCount, setVariantCount] = useState(2);
  const [duration, setDuration] = useState(8);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [seed, setSeed] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [enhancePrompt, setEnhancePrompt] = useState(true);
  const [referenceMode, setReferenceMode] = useState<"reference" | "frames">("reference");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [selectedPresetVariants, setSelectedPresetVariants] = useState<
    Record<string, string>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const models = mediaType === "image" ? IMAGE_MODELS : VIDEO_MODELS;
  const selectedModel = models.find((item) => item.value === model) || models[0];
  const selectedPresets = useMemo(
    () =>
      presetCategories.flatMap((category) => {
        const selectedId = selectedPresetVariants[category.id];
        const variant = category.variants.find((item) => item.id === selectedId);
        return variant ? [{ category, variant }] : [];
      }),
    [presetCategories, selectedPresetVariants],
  );
  const fullPrompt = useMemo(() => {
    const presetParts = selectedPresets.map(
      ({ category, variant }) => `${category.name}:\n${variant.prompt.trim()}`,
    );
    const manualPrompt = prompt.trim();
    if (manualPrompt && presetParts.length > 0) {
      presetParts.push(`Описание сцены:\n${manualPrompt}`);
    } else if (manualPrompt) {
      presetParts.push(manualPrompt);
    }
    return presetParts.join("\n\n");
  }, [prompt, selectedPresets]);

  useEffect(() => {
    if (!selectedModel.resolutions.includes(resolution)) {
      setResolution(selectedModel.resolutions[0]);
    }
    if (!selectedModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(selectedModel.aspectRatios[0]);
    }
    if (selectedModel.durations && !selectedModel.durations.includes(duration)) {
      setDuration(selectedModel.durations[0]);
    }
  }, [aspectRatio, duration, resolution, selectedModel]);

  useEffect(() => {
    setSelectedPresetVariants((current) => {
      const next: Record<string, string> = {};
      for (const category of presetCategories) {
        if (category.variants.some((variant) => variant.id === current[category.id])) {
          next[category.id] = current[category.id];
        }
      }
      return next;
    });
  }, [presetCategories]);

  function handleMediaTypeChange(nextType: MediaType) {
    setMediaType(nextType);
    const nextModel = nextType === "image" ? IMAGE_MODELS[0] : VIDEO_MODELS[0];
    setModel(nextModel.value);
    setResolution(nextModel.resolutions[0]);
    setAspectRatio(nextModel.aspectRatios.includes("16:9") ? "16:9" : nextModel.aspectRatios[0]);
    setStatus(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newPreviews: string[] = [];
    const newBase64: string[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        newPreviews.push(result);
        newBase64.push(result);
        if (newPreviews.length === files.length) {
          setPreviews(newPreviews);
          setUploadedFiles(newBase64);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function clearUploads() {
    setPreviews([]);
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function pollVideo(
    baseParams: GenerateParams,
    submitted: Record<string, unknown>,
    jobId: string,
    generationProjectId: string | null,
  ) {
    let job = submitted;

    for (let attempt = 1; attempt <= VIDEO_MAX_POLLS; attempt += 1) {
      if (job.status !== "completed") await wait(VIDEO_POLL_INTERVAL);

      onGenerationProgress({
        jobId,
        progress: `Видео генерируется… проверка ${attempt}`,
      });

      job = await generateMedia(
        {
          ...baseParams,
          references: [],
          action: "poll",
          jobId: String(job.id || ""),
          pollingUrl: String(job.polling_url || submitted.polling_url || ""),
        },
        generationProjectId,
      );

      if (job.status === "completed") return job;
      if (["failed", "cancelled", "expired"].includes(String(job.status))) {
        throw new Error(String(job.error || `Генерация видео завершилась со статусом ${job.status}`));
      }
    }

    throw new Error("Видео не было готово за 20 минут. Задание осталось в OpenRouter.");
  }

  async function runGeneration(
    params: GenerateParams,
    jobId: string,
    threadId: string,
    generationProjectId: string | null,
  ) {
    try {
      if (params.mediaType === "image") {
        const requestedCount = params.variantCount || 2;
        const variants = await Promise.allSettled(
          Array.from({ length: requestedCount }, async (_, variantIndex) => {
            const data = await generateMedia(
              {
                ...params,
                variantCount: 1,
                generationBatchId: jobId,
                saveReferences: variantIndex === 0,
              },
              generationProjectId,
            );
            if (!Array.isArray(data.files) || data.files.length === 0) {
              throw new Error("OpenRouter не вернул готовое изображение.");
            }
            await onGenerationVariantFinished({
              jobId,
              projectId: generationProjectId,
            });
            return data;
          }),
        );
        const completed = variants.filter(
          (variant): variant is PromiseFulfilledResult<Record<string, unknown>> =>
            variant.status === "fulfilled",
        );
        const failedCount = variants.length - completed.length;

        if (completed.length === 0) {
          const firstFailure = variants.find(
            (variant): variant is PromiseRejectedResult =>
              variant.status === "rejected",
          );
          throw firstFailure?.reason instanceof Error
            ? firstFailure.reason
            : new Error("Не удалось сгенерировать изображения.");
        }

        onGenerationFinished({
          jobId,
          threadId: String(completed[0].value.threadId || threadId),
          projectId: generationProjectId,
          failedCount,
        });
        return;
      }

      const submitted = await generateMedia(params, generationProjectId);
      const data = await pollVideo(
        params,
        submitted,
        jobId,
        generationProjectId,
      );

      if (!Array.isArray(data.files) || data.files.length === 0) {
        throw new Error("OpenRouter не вернул готовый файл.");
      }

      onGenerationFinished({
        jobId,
        threadId: String(data.threadId || threadId),
        projectId: generationProjectId,
      });
    } catch (error) {
      onGenerationFailed({
        jobId,
        error: error instanceof Error ? error.message : "Ошибка запроса",
      });
    }
  }

  function handleGenerate() {
    if (!fullPrompt) return;

    const references = [...uploadedFiles, ...Array.from(selectedImages)];
    if (references.length > 14) {
      setStatus({ type: "error", message: "Можно использовать не более 14 референсов." });
      return;
    }
    if (mediaType === "video" && referenceMode === "frames" && references.length > 2) {
      setStatus({
        type: "error",
        message: "Для режима первого/последнего кадра выберите не более двух изображений.",
      });
      return;
    }

    const threadId = currentThreadId || `thread_${crypto.randomUUID()}`;
    const jobId = `generation_${crypto.randomUUID()}`;
    const submittedAt = new Date().toISOString();

    const params: GenerateParams = {
      mediaType,
      prompt: fullPrompt,
      submittedAt,
      model,
      resolution,
      aspectRatio,
      variantCount: mediaType === "image" ? variantCount : undefined,
      references,
      threadId,
      duration: mediaType === "video" ? duration : undefined,
      generateAudio: mediaType === "video" ? generateAudio : undefined,
      seed: mediaType === "video" && seed.trim() ? Number(seed) : null,
      negativePrompt: mediaType === "video" ? negativePrompt.trim() : undefined,
      enhancePrompt: mediaType === "video" ? enhancePrompt : undefined,
      referenceMode: mediaType === "video" ? referenceMode : undefined,
      action: "submit",
    };

    onGenerationStarted({
      jobId,
      threadId,
      projectId,
      entry: {
        id: jobId,
        timestamp: submittedAt,
        prompt: fullPrompt,
        resolution,
        aspectRatio,
        images: [],
        videos: [],
        mediaType,
        model,
        duration: mediaType === "video" ? duration : undefined,
        generateAudio: mediaType === "video" ? generateAudio : undefined,
        seed: mediaType === "video" && seed.trim() ? Number(seed) : null,
        negativePrompt: mediaType === "video" ? negativePrompt.trim() : undefined,
        status: "pending",
        placeholderCount: mediaType === "image" ? variantCount : 1,
        progress:
          mediaType === "video"
            ? "Отправка задания на генерацию видео…"
            : `Параллельная генерация: ${formatVariantCount(variantCount)}…`,
        cost: null,
      },
    });
    setStatus({ type: "success", message: "Запрос добавлен в чат и выполняется в фоне." });
    clearUploads();
    void runGeneration(params, jobId, threadId, projectId);
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="inline-flex rounded-lg bg-zinc-100 dark:bg-zinc-800 p-1 mb-5">
        <button
          onClick={() => handleMediaTypeChange("image")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            mediaType === "image" ? "bg-white dark:bg-zinc-700 shadow-sm text-blue-600" : "text-zinc-500"
          }`}
        >
          <ImageIcon size={16} />
          Изображение
        </button>
        <button
          onClick={() => handleMediaTypeChange("video")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
            mediaType === "video" ? "bg-white dark:bg-zinc-700 shadow-sm text-violet-600" : "text-zinc-500"
          }`}
        >
          <Film size={16} />
          Видео
        </button>
      </div>

      <div className="mb-4">
        <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Описание {mediaType === "video" ? "видео" : "изображения"}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={mediaType === "video" ? "Опишите сцену, движение камеры и звук…" : "Введите описание изображения…"}
          className="w-full p-3 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm resize-y min-h-[80px] bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
              Пресеты prompt
            </div>
            <div className="text-xs text-zinc-500">
              Выберите готовые описания, которые будут добавлены к prompt.
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPresets}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
          >
            {presetCategories.length === 0 ? <Plus size={14} /> : <Settings2 size={14} />}
            {presetCategories.length === 0 ? "Добавить категорию" : "Настроить"}
          </button>
        </div>

        {presetCategories.length === 0 ? (
          <button
            type="button"
            onClick={onOpenPresets}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 px-4 py-5 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"
          >
            <Plus size={17} />
            Добавить первую категорию пресетов
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {presetCategories.map((category) => (
              <label key={category.id} className="block min-w-0">
                <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <span className="truncate">{category.name}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${category.scope === "global" ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"}`}>
                    {category.scope === "global" ? "общая" : "проект"}
                  </span>
                </span>
                <select
                  value={selectedPresetVariants[category.id] || ""}
                  onChange={(event) =>
                    setSelectedPresetVariants((current) => ({
                      ...current,
                      [category.id]: event.target.value,
                    }))
                  }
                  disabled={category.variants.length === 0}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm disabled:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">
                    {category.variants.length === 0 ? "Нет вариантов" : "Не использовать"}
                  </option>
                  {category.variants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {selectedPresets.length > 0 && (
          <details className="mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-900">
            <summary className="cursor-pointer font-semibold text-zinc-600 dark:text-zinc-300">
              Предпросмотр итогового prompt
            </summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed text-zinc-600 dark:text-zinc-300">
              {fullPrompt}
            </pre>
          </details>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-4">
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Модель</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            {models.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Разрешение</label>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            {selectedModel.resolutions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Соотношение сторон</label>
          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
            {selectedModel.aspectRatios.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        {mediaType === "image" && (
          <div>
            <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Количество вариантов</label>
            <select value={variantCount} onChange={(e) => setVariantCount(Number(e.target.value))} className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
          </div>
        )}
        {mediaType === "video" && (
          <div>
            <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Длительность</label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              {(selectedModel.durations || []).map((item) => <option key={item} value={item}>{item} сек.</option>)}
            </select>
          </div>
        )}
      </div>

      {mediaType === "video" && (
        <div className="rounded-lg border border-violet-200 dark:border-violet-900/60 bg-violet-50/50 dark:bg-violet-950/20 p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Seed (необязательно)</label>
              <input type="number" min="0" step="1" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="Случайный" className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800" />
            </div>
            <div>
              <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Режим изображений</label>
              <select value={referenceMode} onChange={(e) => setReferenceMode(e.target.value as "reference" | "frames")} className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800">
                <option value="reference">Референсы стиля и объектов</option>
                <option value="frames">Первый и последний кадр</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Что исключить (необязательно)</label>
            <input value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="Например: размытие, артефакты, текст" className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800" />
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-zinc-700 dark:text-zinc-300">
            <label className="flex items-center gap-2"><input type="checkbox" checked={generateAudio} onChange={(e) => setGenerateAudio(e.target.checked)} /> Генерировать звук</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={enhancePrompt} onChange={(e) => setEnhancePrompt(e.target.checked)} /> Улучшать промпт</label>
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Загрузить референсы
        </label>
        <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileChange} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400" />
        {mediaType === "video" && (
          <p className="text-xs text-zinc-400 mt-1">
            {referenceMode === "frames" ? "Первое изображение станет начальным кадром, второе — конечным." : "Изображения направляют стиль, объект и визуальную идентичность ролика."}
          </p>
        )}
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {previews.map((src, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={src} alt="" className="w-15 h-15 object-contain rounded border border-zinc-200 dark:border-zinc-700" />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleGenerate} disabled={!fullPrompt} className={`flex items-center gap-2 px-5 py-2.5 ${mediaType === "video" ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700"} disabled:bg-zinc-400 text-white rounded-lg text-sm font-semibold transition-colors`}>
          {mediaType === "video" ? <Film size={16} /> : <Sparkles size={16} />}
          {mediaType === "video" ? "Создать видео" : `Сгенерировать (${variantCount})`}
        </button>

        {status && (
          <span className={`whitespace-pre-line text-sm font-medium ${status.type === "success" ? "text-green-600" : status.type === "error" ? "text-red-500" : "text-zinc-500"}`}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
