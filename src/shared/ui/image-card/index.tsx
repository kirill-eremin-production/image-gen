"use client";

import { useState } from "react";
import { FolderOpen, Maximize2, Trash2 } from "lucide-react";
import { ImageFile } from "@/shared/types";
import { imageUrl } from "@/shared/api";
import { ImageLightbox } from "@/shared/ui/image-lightbox";

interface ImageCardProps {
  file: ImageFile;
  type: string;
  selected?: boolean;
  onSelect?: () => void;
  onReveal?: () => void;
  onDelete?: () => void;
  largePreview?: boolean;
}

export function ImageCard({
  file,
  type,
  selected,
  onSelect,
  onReveal,
  onDelete,
  largePreview,
}: ImageCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const src = imageUrl(type, file.name);
  const isVideo = file.kind === "video" || type === "videos";

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-lg border-2 transition-colors bg-zinc-100 dark:bg-zinc-800 ${
        selected
          ? "border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
          : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
      }`}
    >
      {isVideo ? (
        <video
          src={src}
          controls
          preload="metadata"
          className={`w-full object-contain ${largePreview ? "max-h-[500px]" : "aspect-square"}`}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={file.name}
          onClick={onSelect}
          className={`w-full object-contain ${onSelect ? "cursor-pointer" : ""} ${
            largePreview ? "max-h-[500px]" : "aspect-square"
          }`}
        />
      )}
      <div className="flex justify-center gap-1 p-1 bg-white dark:bg-zinc-900">
        {!isVideo && (
          <button
            onClick={() => setPreviewOpen(true)}
            aria-label="Смотреть на весь экран"
            title="Смотреть на весь экран"
            className="rounded-md bg-blue-600 p-1.5 text-white transition-colors hover:bg-blue-700"
          >
            <Maximize2 size={14} />
          </button>
        )}
        <button
          onClick={onReveal}
          aria-label="Показать в Finder"
          title="Показать в Finder"
          className="rounded-md bg-zinc-500 p-1.5 text-white transition-colors hover:bg-zinc-600"
        >
          <FolderOpen size={14} />
        </button>
        <button
          onClick={onDelete}
          aria-label="Удалить файл"
          title="Удалить файл"
          className="rounded-md bg-red-500 p-1.5 text-white transition-colors hover:bg-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {previewOpen && (
        <ImageLightbox
          src={src}
          alt={file.name}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
