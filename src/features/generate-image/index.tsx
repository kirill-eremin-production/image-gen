"use client";

import { useState, useRef } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { MODELS, RESOLUTIONS, ASPECT_RATIOS } from "@/shared/config";
import { generateImage } from "@/shared/api";

interface GenerateImageProps {
  selectedImages: Set<string>;
  currentThreadId: string | null;
  onGenerated: (data: { threadId: string }) => void;
}

export function GenerateImage({
  selectedImages,
  currentThreadId,
  onGenerated,
}: GenerateImageProps) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].value);
  const [resolution, setResolution] = useState<string>("1K");
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function handleGenerate() {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStatus(null);

    const references = [...uploadedFiles, ...Array.from(selectedImages)];

    try {
      const data = await generateImage({
        prompt,
        model,
        resolution,
        aspectRatio,
        references,
        threadId: currentThreadId,
      });

      if (data.choices?.[0]?.message?.images) {
        const costText =
          data.usage?.cost != null ? ` | $${data.usage.cost.toFixed(4)}` : "";
        setStatus({ type: "success", message: `Готово!${costText}` });
        onGenerated({ threadId: data.threadId });
        setPreviews([]);
        setUploadedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setStatus({
          type: "error",
          message: data.error?.message || JSON.stringify(data),
        });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "Ошибка запроса",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800">
      <div className="mb-4">
        <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Описание изображения
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Введите описание изображения..."
          className="w-full p-3 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm resize-y min-h-[80px] bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Модель
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Разрешение
          </label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            {RESOLUTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Соотношение сторон
          </label>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          >
            {ASPECT_RATIOS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Загрузить референсы
        </label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/30 dark:file:text-blue-400"
        />
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                className="w-15 h-15 object-contain rounded border border-zinc-200 dark:border-zinc-700"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {isGenerating ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {isGenerating ? "Генерация..." : "Сгенерировать"}
        </button>

        {status && (
          <span
            className={`text-sm font-medium ${
              status.type === "success" ? "text-green-600" : "text-red-500"
            }`}
          >
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
}
