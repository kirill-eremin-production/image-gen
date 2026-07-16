"use client";

import { Plus, X, Trash2, Settings, WandSparkles } from "lucide-react";
import { Thread, ProjectInfo } from "@/shared/types";

interface SidebarProps {
  threads: Thread[];
  currentThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewChat: () => void;
  onDeleteThread: (id: string) => void;
  onClearAll: () => void;
  projects: ProjectInfo[];
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: () => void;
  onProjectSettings: (project: ProjectInfo) => void;
  onClearAllFiles: () => void;
  onOpenPresets: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  threads,
  currentThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onClearAll,
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onProjectSettings,
  onClearAllFiles,
  onOpenPresets,
  onOpenSettings,
}: SidebarProps) {
  const sortedThreads = [...threads].sort((a, b) => {
    const lastA = a.history.length > 0 ? new Date(a.history[a.history.length - 1].timestamp).getTime() : 0;
    const lastB = b.history.length > 0 ? new Date(b.history[b.history.length - 1].timestamp).getTime() : 0;
    return lastB - lastA;
  });

  return (
    <aside className="w-64 bg-zinc-900 text-white flex flex-col shrink-0">
      {/* Projects */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            Проекты
          </span>
          <button
            onClick={onCreateProject}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="space-y-1">
          {/* General workspace */}
          <button
            onClick={() => onSelectProject(null)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors ${
              activeProjectId === null ? "bg-zinc-700" : "hover:bg-zinc-800"
            }`}
          >
            <div className="w-7 h-7 rounded-md bg-zinc-600 flex items-center justify-center text-xs">
              🏠
            </div>
            <span className="truncate">Общее</span>
          </button>

          {projects.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                activeProjectId === p.id ? "bg-zinc-700" : "hover:bg-zinc-800"
              }`}
              onClick={() => onSelectProject(p.id)}
            >
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center text-xs shrink-0"
                style={{ backgroundColor: p.color }}
              >
                {p.icon}
              </div>
              <span className="flex-1 truncate">{p.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectSettings(p);
                }}
                className="hidden group-hover:block text-zinc-500 hover:text-white transition-colors"
              >
                <Settings size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Threads */}
      <div className="flex-1 flex flex-col p-3 min-h-0">
        <button
          onClick={onNewChat}
          className="flex items-center justify-center gap-2 border border-zinc-600 rounded-lg py-3 mb-3 hover:bg-zinc-800 transition-colors text-sm shrink-0"
        >
          <Plus size={16} />
          Новый чат
        </button>

        <div className="flex-1 overflow-y-auto space-y-1">
          {sortedThreads.map((thread) => (
            <div
              key={thread.id}
              className={`group flex items-center gap-1 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                thread.id === currentThreadId
                  ? "bg-zinc-700"
                  : "hover:bg-zinc-800"
              }`}
              onClick={() => onSelectThread(thread.id)}
            >
              <span className="flex-1 truncate">
                {thread.title || "Без названия"}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteThread(thread.id);
                }}
                className="hidden group-hover:block text-zinc-500 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        {threads.length > 0 && (
          <button
            onClick={onClearAll}
            className="flex items-center justify-center gap-2 mt-3 border border-zinc-700 rounded-lg py-2 text-xs text-zinc-500 hover:text-red-400 hover:border-red-400/50 hover:bg-red-950/20 transition-colors shrink-0"
          >
            <Trash2 size={12} />
            Удалить все чаты
          </button>
        )}

        <button
          onClick={onClearAllFiles}
          className="flex items-center justify-center gap-2 mt-2 border border-zinc-700 rounded-lg py-2 text-xs text-zinc-500 hover:text-red-400 hover:border-red-400/50 hover:bg-red-950/20 transition-colors shrink-0"
        >
          <Trash2 size={12} />
          Удалить все файлы проекта
        </button>
      </div>

      {/* App settings */}
      <div className="p-3 border-t border-zinc-800 shrink-0">
        <button
          onClick={onOpenPresets}
          className="mb-1 w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <WandSparkles size={16} />
          Пресеты prompt
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
        >
          <Settings size={16} />
          Настройки
        </button>
      </div>
    </aside>
  );
}
