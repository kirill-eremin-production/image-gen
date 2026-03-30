"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { ProjectInfo } from "@/shared/types";

interface ProjectPasswordDialogProps {
  open: boolean;
  project: ProjectInfo | null;
  onUnlock: (password: string) => void;
  onCancel: () => void;
}

export function ProjectPasswordDialog({
  open,
  project,
  onUnlock,
  onCancel,
}: ProjectPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!open || !project) return null;

  function handleSubmit() {
    if (!password) {
      setError("Введите пароль");
      return;
    }
    setError("");
    onUnlock(password);
    setPassword("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-col items-center mb-5">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-3"
            style={{ backgroundColor: project.color }}
          >
            {project.icon}
          </div>
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            {project.name}
          </h2>
          <p className="text-sm text-zinc-500 mt-1 flex items-center gap-1">
            <Lock size={12} />
            Проект защищён паролем
          </p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Пароль"
          className="w-full p-2.5 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          autoFocus
        />

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Открыть
          </button>
        </div>
      </div>
    </div>
  );
}
