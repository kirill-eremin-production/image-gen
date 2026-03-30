"use client";

import { useState } from "react";
import { X, Lock, LockOpen } from "lucide-react";
import { ProjectInfo } from "@/shared/types";

const PRESET_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];

const PRESET_ICONS = [
  "📁", "🎨", "📸", "🏠", "💼", "🎮", "🎵", "📱",
  "🌍", "🔬", "📝", "⭐", "🚀", "💡", "🎯", "🛠️",
];

interface ProjectDialogProps {
  open: boolean;
  project?: ProjectInfo | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    icon: string;
    color: string;
    password?: string;
    removePassword?: boolean;
  }) => void;
  onDelete?: (id: string) => void;
}

export function ProjectDialog({ open, project, onClose, onSave, onDelete }: ProjectDialogProps) {
  const [name, setName] = useState(project?.name || "");
  const [icon, setIcon] = useState(project?.icon || "📁");
  const [color, setColor] = useState(project?.color || PRESET_COLORS[0]);
  const [password, setPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);

  if (!open) return null;

  const isEdit = !!project;

  function handleSubmit() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      icon,
      color,
      password: password || undefined,
      removePassword: removePassword || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {isEdit ? "Настройки проекта" : "Новый проект"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X size={20} />
          </button>
        </div>

        {/* Preview */}
        <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: color }}
          >
            {icon}
          </div>
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            {name || "Название проекта"}
          </span>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Название
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Мой проект"
            className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>

        {/* Icon */}
        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Иконка
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_ICONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setIcon(emoji)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                  icon === emoji
                    ? "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="mb-4">
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Цвет
          </label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${
                  color === c ? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-zinc-900" : ""
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-full cursor-pointer border-0 p-0 bg-transparent"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-5">
          <label className="block mb-1.5 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span className="flex items-center gap-1.5">
              {password || (isEdit && project?.hasPassword && !removePassword) ? (
                <Lock size={14} />
              ) : (
                <LockOpen size={14} />
              )}
              Пароль (опционально)
            </span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setRemovePassword(false);
            }}
            placeholder={isEdit && project?.hasPassword ? "Новый пароль (оставьте пустым — без изменений)" : "Без пароля"}
            className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isEdit && project?.hasPassword && !removePassword && (
            <button
              onClick={() => {
                setRemovePassword(true);
                setPassword("");
              }}
              className="mt-2 text-xs text-red-500 hover:text-red-400"
            >
              Убрать пароль
            </button>
          )}
          {removePassword && (
            <span className="mt-2 block text-xs text-red-500">Пароль будет убран</span>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {isEdit ? "Сохранить" : "Создать"}
        </button>

        {isEdit && onDelete && project && (
          <button
            onClick={() => onDelete(project.id)}
            className="w-full mt-2 py-2.5 border border-red-300 dark:border-red-800 text-red-500 rounded-lg text-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            Удалить проект
          </button>
        )}
      </div>
    </div>
  );
}
