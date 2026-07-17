"use client";

import { AlertCircle, Film, Loader2 } from "lucide-react";
import { Thread } from "@/shared/types";
import { ImageCard } from "@/shared/ui/image-card";
import { revealImage, deleteImage } from "@/shared/api";

interface ThreadHistoryProps {
  thread: Thread | null;
  onImageDeleted: () => void;
}

export function ThreadHistory({ thread, onImageDeleted }: ThreadHistoryProps) {
  if (!thread || thread.history.length === 0) return null;

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
  );
}
