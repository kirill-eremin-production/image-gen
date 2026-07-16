"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Folder,
  Globe2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  createPromptPresetCategory,
  createPromptPresetVariant,
  deletePromptPresetCategory,
  deletePromptPresetVariant,
  updatePromptPresetCategory,
  updatePromptPresetVariant,
} from "@/shared/api";
import {
  PromptPresetCategory,
  PromptPresetScope,
  PromptPresetVariant,
} from "@/shared/types";

interface PromptPresetsProps {
  categories: PromptPresetCategory[];
  activeProjectId: string | null;
  activeProjectName?: string;
  onChange: (categories: PromptPresetCategory[]) => void;
  onClose: () => void;
}

interface VariantEditorProps {
  categoryId: string;
  variant: PromptPresetVariant;
  onChange: (categories: PromptPresetCategory[]) => void;
  onError: (message: string) => void;
}

function VariantEditor({
  categoryId,
  variant,
  onChange,
  onError,
}: VariantEditorProps) {
  const [name, setName] = useState(variant.name);
  const [prompt, setPrompt] = useState(variant.prompt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(variant.name);
    setPrompt(variant.prompt);
  }, [variant.name, variant.prompt]);

  async function handleSave() {
    setSaving(true);
    try {
      onChange(
        await updatePromptPresetVariant(categoryId, variant.id, {
          name,
          prompt,
        }),
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось сохранить вариант.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Удалить вариант «${variant.name}»?`)) return;
    try {
      onChange(await deletePromptPresetVariant(categoryId, variant.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось удалить вариант.");
    }
  }

  const changed = name.trim() !== variant.name || prompt.trim() !== variant.prompt;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/40">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Название варианта"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !changed || !name.trim() || !prompt.trim()}
          title="Сохранить вариант"
          className="rounded-lg border border-zinc-300 px-3 text-zinc-600 hover:bg-white disabled:opacity-35 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Save size={16} />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          title="Удалить вариант"
          className="rounded-lg border border-red-200 px-3 text-red-500 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/30"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Текст, который будет добавлен в итоговый prompt"
        className="mt-2 min-h-24 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
      />
    </div>
  );
}

interface CategoryEditorProps {
  category: PromptPresetCategory;
  onChange: (categories: PromptPresetCategory[]) => void;
  onError: (message: string) => void;
}

function CategoryEditor({ category, onChange, onError }: CategoryEditorProps) {
  const [name, setName] = useState(category.name);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [variantPrompt, setVariantPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(category.name), [category.name]);

  async function handleCategorySave() {
    setSaving(true);
    try {
      onChange(await updatePromptPresetCategory(category.id, name));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось сохранить категорию.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCategoryDelete() {
    if (!confirm(`Удалить категорию «${category.name}» и все её варианты?`)) return;
    try {
      onChange(await deletePromptPresetCategory(category.id));
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось удалить категорию.");
    }
  }

  async function handleVariantCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      onChange(
        await createPromptPresetVariant(category.id, {
          name: variantName,
          prompt: variantPrompt,
        }),
      );
      setVariantName("");
      setVariantPrompt("");
      setShowVariantForm(false);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось добавить вариант.");
    } finally {
      setSaving(false);
    }
  }

  const changed = name.trim() !== category.name;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            category.scope === "global"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
              : "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
          }`}
        >
          {category.scope === "global" ? <Globe2 size={12} /> : <Folder size={12} />}
          {category.scope === "global" ? "Общая" : "Проектная"}
        </span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 font-semibold dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="button"
          onClick={handleCategorySave}
          disabled={saving || !changed || !name.trim()}
          title="Сохранить название"
          className="rounded-lg border border-zinc-300 p-2.5 text-zinc-600 hover:bg-zinc-50 disabled:opacity-35 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Save size={16} />
        </button>
        <button
          type="button"
          onClick={handleCategoryDelete}
          title="Удалить категорию"
          className="rounded-lg border border-red-200 p-2.5 text-red-500 hover:bg-red-50 dark:border-red-950 dark:hover:bg-red-950/30"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {category.variants.map((variant) => (
          <VariantEditor
            key={variant.id}
            categoryId={category.id}
            variant={variant}
            onChange={onChange}
            onError={onError}
          />
        ))}
        {category.variants.length === 0 && !showVariantForm && (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-5 text-center text-sm text-zinc-500 dark:border-zinc-700">
            В этой категории пока нет вариантов.
          </p>
        )}
      </div>

      {showVariantForm ? (
        <form onSubmit={handleVariantCreate} className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-950 dark:bg-blue-950/20">
          <input
            autoFocus
            value={variantName}
            onChange={(event) => setVariantName(event.target.value)}
            placeholder="Название, например «Главный герой»"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <textarea
            value={variantPrompt}
            onChange={(event) => setVariantPrompt(event.target.value)}
            placeholder="Подробное описание персонажа, локации или действия"
            className="mt-2 min-h-28 w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={saving || !variantName.trim() || !variantPrompt.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-400"
            >
              Добавить вариант
            </button>
            <button
              type="button"
              onClick={() => setShowVariantForm(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowVariantForm(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <Plus size={16} />
          Добавить вариант
        </button>
      )}
    </section>
  );
}

export function PromptPresets({
  categories,
  activeProjectId,
  activeProjectName,
  onChange,
  onClose,
}: PromptPresetsProps) {
  const [categoryName, setCategoryName] = useState("");
  const [scope, setScope] = useState<PromptPresetScope>(
    activeProjectId ? "project" : "global",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activeProjectId) setScope("global");
  }, [activeProjectId]);

  async function handleCategoryCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      onChange(await createPromptPresetCategory({ name: categoryName, scope }));
      setCategoryName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось добавить категорию.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-zinc-300 p-2.5 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
          title="Вернуться к генератору"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            Пресеты prompt
          </h1>
          <p className="text-sm text-zinc-500">
            Общие категории видны везде, проектные — только в {activeProjectName || "текущем проекте"}.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCategoryCreate}
        className="mb-5 rounded-xl border border-blue-200 bg-blue-50/60 p-5 dark:border-blue-950 dark:bg-blue-950/20"
      >
        <h2 className="mb-3 font-semibold text-zinc-800 dark:text-zinc-100">
          Новая категория
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
            placeholder="Например: Персонаж, Локация, Action-сцена"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value as PromptPresetScope)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="global">Общая категория</option>
            {activeProjectId && <option value="project">Только этот проект</option>}
          </select>
          <button
            type="submit"
            disabled={saving || !categoryName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-zinc-400"
          >
            <Plus size={16} />
            Добавить категорию
          </button>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
      </form>

      <div className="space-y-4">
        {categories.map((category) => (
          <CategoryEditor
            key={category.id}
            category={category}
            onChange={(next) => {
              setError("");
              onChange(next);
            }}
            onError={setError}
          />
        ))}
        {categories.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white/50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
            <p className="font-semibold text-zinc-700 dark:text-zinc-200">
              Категорий пока нет
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Создайте первую категорию выше, а затем добавьте в неё варианты.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
