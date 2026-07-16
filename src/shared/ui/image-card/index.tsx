"use client";

import { FolderOpen, Trash2 } from "lucide-react";
import { ImageFile } from "@/shared/types";
import { imageUrl } from "@/shared/api";

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
  const src = imageUrl(type, file.name);
  const isVideo = file.kind === "video" || type === "videos";

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border-2 transition-colors bg-zinc-100 dark:bg-zinc-800 ${
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
          className={`w-full object-contain ${largePreview ? "max-h-[500px]" : "max-h-[300px]"}`}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={file.name}
          onClick={onSelect}
          className={`w-full object-contain ${onSelect ? "cursor-pointer" : ""} ${
            largePreview ? "max-h-[500px]" : "max-h-[300px]"
          }`}
        />
      )}
      <div className="flex justify-center gap-1 p-1 bg-white dark:bg-zinc-900">
        <button
          onClick={onReveal}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-zinc-500 hover:bg-zinc-600 text-white transition-colors"
        >
          <FolderOpen size={12} />
          Finder
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-red-500 hover:bg-red-600 text-white transition-colors"
        >
          <Trash2 size={12} />
          Удалить
        </button>
      </div>
    </div>
  );
}
