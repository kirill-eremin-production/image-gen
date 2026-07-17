"use client";

import { useState } from "react";
import { AlertCircle, Film, Images, Loader2 } from "lucide-react";
import { GenerationReference, Thread } from "@/shared/types";
import { ImageCard } from "@/shared/ui/image-card";
import { ImageLightbox } from "@/shared/ui/image-lightbox";
import { revealImage, deleteImage } from "@/shared/api";

interface ThreadHistoryProps {
  thread: Thread | null;
  onImageDeleted: () => void;
}

export function ThreadHistory({ thread, onImageDeleted }: ThreadHistoryProps) {
  const [previewReference, setPreviewReference] = useState<GenerationReference | null>(null);
  if (!thread || thread.history.length === 0) return null;

  function roleLabel(reference: GenerationReference) {
    if (reference.role === "first_frame") return "Первый кадр · frame_images[0]";
    if (reference.role === "last_frame") return "Последний кадр · frame_images[1]";
    return reference.role === "primary"
      ? "Основной по порядку"
      : `Дополнительный · №${reference.order + 1}`;
  }

  async function handleReveal(name: string) {
    await revealImage("generated", name);
  }

  async function handleDelete(name: string) {
    if (!confirm("Удалить это изображение?")) return;
    await deleteImage("generated", name);
    onImageDeleted();
  }

  async function handleDeleteVideo(name: string) {
    if (!confirm("Удалить это видео?")) return;
    await deleteImage("videos", name);
    onImageDeleted();
  }

  return (
    <>
    <div className="mt-6 space-y-6">
      {thread.history.map((entry, i) => {
        const costStr = entry.cost != null ? ` | $${entry.cost.toFixed(4)}` : "";
        const mediaLabel = entry.mediaType === "video" ? "Видео" : "Изображение";
        const durationStr = entry.duration ? ` | ${entry.duration} сек.` : "";
        const audioStr = entry.mediaType === "video" ? ` | звук: ${entry.generateAudio ? "да" : "нет"}` : "";
        return (
          <div key={i} className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
            <div className="text-xs text-zinc-500 mb-1">
              {new Date(entry.timestamp).toLocaleString()} | {mediaLabel} | {entry.resolution} |{" "}
              {entry.aspectRatio}{durationStr}{audioStr}
              {costStr}
            </div>
            {entry.model && (
              <div className="text-xs text-zinc-400 mb-1">{entry.model}</div>
            )}
            <div className="mb-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Полный prompt, отправленный модели
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm font-semibold leading-relaxed text-zinc-800 dark:text-zinc-200">
                {entry.prompt}
              </pre>
            </div>
            {(entry.references || []).length > 0 && (
              <div className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  <Images size={14} />
                  Референсы запроса · {entry.references?.length}
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
                  {entry.references?.map((reference) => (
                    <button
                      key={`${reference.order}-${reference.url}`}
                      type="button"
                      onClick={() => setPreviewReference(reference)}
                      className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 text-left transition-colors hover:border-blue-400 dark:border-zinc-700 dark:bg-zinc-800"
                    >
                      <div className="relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reference.url}
                          alt={`Референс ${reference.order + 1}`}
                          className="h-full w-full object-contain"
                        />
                        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-bold text-white">
                          №{reference.order + 1}
                        </span>
                      </div>
                      <div className="p-2">
                        <div className="truncate text-[10px] font-semibold text-zinc-700 dark:text-zinc-200">
                          {roleLabel(reference)}
                        </div>
                        <div className="mt-1 truncate text-[9px] text-zinc-400">
                          {reference.source === "upload"
                            ? "Скопирован в проект"
                            : reference.source === "library"
                              ? "Ссылка на библиотеку"
                              : "Внешняя ссылка"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
              {entry.status === "pending" &&
                Array.from(
                  { length: entry.placeholderCount || 1 },
                  (_, placeholderIndex) => (
                    <div
                      key={`${entry.id || i}-pending-${placeholderIndex}`}
                      className="relative flex min-h-48 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                      style={{ aspectRatio: entry.aspectRatio.replace(":", " / ") }}
                    >
                      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-100 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800" />
                      <div className="relative flex max-w-[85%] flex-col items-center gap-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-300">
                        {entry.mediaType === "video" ? (
                          <Film className="animate-pulse" size={28} />
                        ) : (
                          <Loader2 className="animate-spin" size={28} />
                        )}
                        <span>{entry.progress || "Генерация…"}</span>
                      </div>
                    </div>
                  ),
                )}
              {entry.status === "failed" && (
                <div className="col-span-full flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle className="mt-0.5 shrink-0" size={18} />
                  <div>
                    <div className="font-semibold">Генерация не удалась</div>
                    <div className="mt-1 whitespace-pre-line text-xs opacity-90">
                      {entry.error || "Неизвестная ошибка"}
                    </div>
                  </div>
                </div>
              )}
              {entry.images.map((img) => (
                <ImageCard
                  key={img.name}
                  file={img}
                  type="generated"
                  largePreview
                  onReveal={() => handleReveal(img.name)}
                  onDelete={() => handleDelete(img.name)}
                />
              ))}
              {(entry.videos || []).map((video) => (
                <ImageCard
                  key={video.name}
                  file={{ ...video, kind: "video" }}
                  type="videos"
                  largePreview
                  onReveal={() => revealImage("videos", video.name)}
                  onDelete={() => handleDeleteVideo(video.name)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
    {previewReference && (
      <ImageLightbox
        src={previewReference.url}
        alt={`Референс ${previewReference.order + 1}: ${roleLabel(previewReference)}`}
        onClose={() => setPreviewReference(null)}
      />
    )}
    </>
  );
}
