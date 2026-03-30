"use client";

import { Trash2 } from "lucide-react";
import { ImageFile } from "@/shared/types";
import { ImageCard } from "@/shared/ui/image-card";
import { revealImage, deleteImage, deleteAllImages } from "@/shared/api";

interface ImageLibraryProps {
  references: ImageFile[];
  generated: ImageFile[];
  selectedImages: Set<string>;
  onToggleSelect: (url: string) => void;
  onImagesChanged: () => void;
}

export function ImageLibrary({
  references,
  generated,
  selectedImages,
  onToggleSelect,
  onImagesChanged,
}: ImageLibraryProps) {
  async function handleReveal(type: string, name: string) {
    await revealImage(type, name);
  }

  async function handleDelete(type: string, name: string) {
    if (!confirm("Удалить это изображение?")) return;
    await deleteImage(type, name);
    onImagesChanged();
  }

  async function handleDeleteAll(type: "references" | "generated", label: string) {
    if (!confirm(`Удалить все файлы из "${label}"? Это действие необратимо.`)) return;
    await deleteAllImages(type);
    onImagesChanged();
  }

  const sortedRefs = [...references].sort((a, b) => b.name.localeCompare(a.name));
  const sortedGens = [...generated].sort((a, b) => b.name.localeCompare(a.name));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl p-5 shadow-sm border border-zinc-200 dark:border-zinc-800 mt-8">
      <div className="flex items-center justify-between pb-2 mb-4 border-b-2 border-blue-500">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Библиотека референсов
        </h3>
        {sortedRefs.length > 0 && (
          <button
            onClick={() => handleDeleteAll("references", "Библиотека референсов")}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
            Удалить все
          </button>
        )}
      </div>
      {sortedRefs.length === 0 ? (
        <p className="text-sm text-zinc-400">Нет референсов</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {sortedRefs.map((file) => (
            <ImageCard
              key={file.name}
              file={file}
              type="references"
              selected={selectedImages.has(file.url)}
              onSelect={() => onToggleSelect(file.url)}
              onReveal={() => handleReveal("references", file.name)}
              onDelete={() => handleDelete("references", file.name)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pb-2 mb-4 mt-8 border-b-2 border-blue-500">
        <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
          Все сгенерированные
        </h3>
        {sortedGens.length > 0 && (
          <button
            onClick={() => handleDeleteAll("generated", "Все сгенерированные")}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
            Удалить все
          </button>
        )}
      </div>
      {sortedGens.length === 0 ? (
        <p className="text-sm text-zinc-400">Нет изображений</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          {sortedGens.map((file) => (
            <ImageCard
              key={file.name}
              file={file}
              type="generated"
              selected={selectedImages.has(file.url)}
              onSelect={() => onToggleSelect(file.url)}
              onReveal={() => handleReveal("generated", file.name)}
              onDelete={() => handleDelete("generated", file.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
