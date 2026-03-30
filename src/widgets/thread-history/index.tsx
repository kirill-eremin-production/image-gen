"use client";

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

  return (
    <div className="mt-6 space-y-6">
      {thread.history.map((entry, i) => {
        const costStr = entry.cost != null ? ` | $${entry.cost.toFixed(4)}` : "";
        return (
          <div key={i} className="border-b border-zinc-200 dark:border-zinc-800 pb-5">
            <div className="text-xs text-zinc-500 mb-1">
              {new Date(entry.timestamp).toLocaleString()} | {entry.resolution} |{" "}
              {entry.aspectRatio}
              {costStr}
            </div>
            <div className="font-semibold text-zinc-800 dark:text-zinc-200 mb-3">
              {entry.prompt}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
