"use client";

import { useState } from "react";
import { KeyRound, Save } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onSaved: () => void;
}

export function SettingsDialog({ open, onSaved }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-3 mb-4">
          <KeyRound size={24} className="text-blue-500" />
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
            Настройка API ключа
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

        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="sk-or-v1-..."
          className="w-full p-3 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          autoFocus
        />

        {error && (
          <p className="text-sm text-red-500 mb-3">{error}</p>
        )}

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
