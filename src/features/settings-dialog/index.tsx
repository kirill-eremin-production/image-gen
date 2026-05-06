"use client";

import { useEffect, useState } from "react";
import { KeyRound, Save, X, Eye, EyeOff } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onSaved: () => void;
  onClose?: () => void;
  required?: boolean;
}

export function SettingsDialog({ open, onSaved, onClose, required }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setReveal(false);
    setApiKey("");
  }, [open]);

  if (!open) return null;

  async function handleSave() {
    if (!apiKey.trim()) {
      setError("Введите ключ");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openrouterApiKey: apiKey.trim() }),
      });

      if (res.ok) {
        onSaved();
      } else {
        setError("Ошибка сохранения");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  const canClose = !required && !!onClose;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={canClose ? onClose : undefined}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-700 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-3 mb-4">
          <KeyRound size={24} className="text-blue-500" />
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            Настройки приложения
          </h2>
        </div>

        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
          Для работы приложения необходим ключ OpenRouter. Получить его можно на{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            openrouter.ai/keys
          </a>
        </p>

        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
          API ключ OpenRouter
        </label>
        <div className="relative mb-3">
          <input
            type={reveal ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="sk-or-v1-..."
            className="w-full p-3 pr-10 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            aria-label={reveal ? "Скрыть ключ" : "Показать ключ"}
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-400 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Save size={16} />
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
