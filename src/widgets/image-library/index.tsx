"use client";

import { useState } from "react";
import { Film, Images, Sparkles, Trash2 } from "lucide-react";
import { ImageFile } from "@/shared/types";
import { ImageCard } from "@/shared/ui/image-card";
import { revealImage, deleteImage, deleteAllImages } from "@/shared/api";

interface ImageLibraryProps {
  references: ImageFile[];
  generated: ImageFile[];
  videos: ImageFile[];
  selectedImages: Set<string>;
  onToggleSelect: (url: string) => void;
  onImagesChanged: () => void;
}

type LibraryTab = "references" | "generated" | "videos";

const TAB_META = {
  references: {
    label: "Референсы",
    title: "Библиотека референсов",
    empty: "Нет референсов",
    icon: Images,
  },
  generated: {
    label: "Генерации",
    title: "Сгенерированные изображения",
    empty: "Нет изображений",
    icon: Sparkles,
  },
  videos: {
    label: "Видео",
    title: "Сгенерированные видео",
    empty: "Нет видео",
    icon: Film,
  },
} as const;

export function ImageLibrary({
  references,
  generated,
  videos,
  selectedImages,
  onToggleSelect,
  onImagesChanged,
}: ImageLibraryProps) {
  const [activeTab, setActiveTab] = useState<LibraryTab>("references");

  async function handleReveal(type: string, name: string) {
    await revealImage(type, name);
  }

  async function handleDelete(type: string, name: string) {
    if (!confirm("Удалить этот файл?")) return;
    await deleteImage(type, name);
    onImagesChanged();
  }

  async function handleDeleteAll(type: LibraryTab, label: string) {
    if (!confirm(`Удалить все файлы из "${label}"? Это действие необратимо.`)) return;
    await deleteAllImages(type);
    onImagesChanged();
  }

  const filesByTab: Record<LibraryTab, ImageFile[]> = {
    references: [...references].sort((a, b) => b.name.localeCompare(a.name)),
    generated: [...generated].sort((a, b) => b.name.localeCompare(a.name)),
    videos: [...videos].sort((a, b) => b.name.localeCompare(a.name)),
  };
  const counts: Record<LibraryTab, number> = {
    references: references.length,
    generated: generated.length,
    videos: videos.length,
  };
  const activeFiles = filesByTab[activeTab];
  const activeMeta = TAB_META[activeTab];

  return (
    <div className="min-h-full bg-white p-3 dark:bg-zinc-900">
      <div className="sticky -top-3 z-20 -mx-3 -mt-3 mb-4 border-b border-zinc-200 bg-white/95 px-3 pt-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(TAB_META) as LibraryTab[]).map((tab) => {
            const meta = TAB_META[tab];
            const Icon = meta.icon;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex min-w-0 flex-col items-center gap-1 rounded-t-lg border-b-2 px-1 py-2 text-[11px] font-semibold transition-colors ${
                  isActive
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300"
                    : "border-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                <span className="flex items-center gap-1">
                  <Icon size={14} />
                  <span className="truncate">{meta.label}</span>
                </span>
                <span className="text-[10px] font-medium opacity-70">{counts[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          {activeMeta.title}
        </h3>
        {activeFiles.length > 0 && (
          <button
            type="button"
            onClick={() => handleDeleteAll(activeTab, activeMeta.title)}
            aria-label={`Удалить все: ${activeMeta.title}`}
            title="Удалить все"
            className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {activeFiles.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-8 text-center text-sm text-zinc-400 dark:border-zinc-700">
          {activeMeta.empty}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {activeFiles.map((file) => (
            <div key={file.name} className="min-w-0">
              <ImageCard
                file={file}
                type={activeTab}
                selected={
                  activeTab === "videos" ? undefined : selectedImages.has(file.url)
                }
                onSelect={
                  activeTab === "videos"
                    ? undefined
                    : () => onToggleSelect(file.url)
                }
                onReveal={() => handleReveal(activeTab, file.name)}
                onDelete={() => handleDelete(activeTab, file.name)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
