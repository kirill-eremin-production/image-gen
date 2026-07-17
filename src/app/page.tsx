"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Thread,
  ImageFile,
  ProjectInfo,
  PromptPresetCategory,
} from "@/shared/types";
import {
  fetchThreads,
  fetchFiles,
  fetchSettings,
  fetchProjects,
  deleteThread,
  clearAllThreads,
  createProject,
  updateProject,
  deleteProject,
  authProject,
  setActiveProjectId,
  deleteAllImages,
  fetchPromptPresets,
} from "@/shared/api";
import { Sidebar } from "@/widgets/sidebar";
import { GenerateImage, PendingGeneration } from "@/features/generate-image";
import { ThreadHistory } from "@/widgets/thread-history";
import { ImageLibrary } from "@/widgets/image-library";
import { SettingsDialog } from "@/features/settings-dialog";
import { ProjectDialog } from "@/features/project-dialog";
import { ProjectPasswordDialog } from "@/features/project-password-dialog";
import { PromptPresets } from "@/features/prompt-presets";

const ACTIVE_PROJECT_STORAGE_KEY = "image-generator-active-project-id";
const UNLOCKED_PROJECTS_COOKIE = "unlocked_projects";

function getStoredActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
}

function getUnlockedProjectsFromCookie(): Set<string> {
  if (typeof document === "undefined") return new Set();

  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${UNLOCKED_PROJECTS_COOKIE}=`));

  if (!cookie) return new Set();

  const raw = decodeURIComponent(cookie.split("=")[1] || "");
  return new Set(raw.split(",").filter(Boolean));
}

export default function Home() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<PendingGeneration[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [references, setReferences] = useState<ImageFile[]>([]);
  const [generated, setGenerated] = useState<ImageFile[]>([]);
  const [videos, setVideos] = useState<ImageFile[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [presetCategories, setPresetCategories] = useState<PromptPresetCategory[]>([]);
  const [showPromptPresets, setShowPromptPresets] = useState(false);
  const [leftPanelWidth, setLeftPanelWidth] = useState("18%");
  const [rightPanelWidth, setRightPanelWidth] = useState("25%");
  const [resizingPanel, setResizingPanel] = useState<"left" | "right" | null>(null);

  // Projects state
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [activeProjectId, setActiveProject] = useState<string | null>(
    getStoredActiveProjectId,
  );
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() =>
    getUnlockedProjectsFromCookie(),
  );
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectInfo | null>(null);
  const [passwordProject, setPasswordProject] = useState<ProjectInfo | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (activeProjectId) {
      window.localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, activeProjectId);
    } else {
      window.localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (!resizingPanel) return;

    function handlePointerMove(event: PointerEvent) {
      if (resizingPanel === "left") {
        setLeftPanelWidth(`${Math.max(0, event.clientX)}px`);
      } else {
        setRightPanelWidth(
          `${Math.max(0, window.innerWidth - event.clientX)}px`,
        );
      }
    }

    function handlePointerUp() {
      setResizingPanel(null);
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [resizingPanel]);

  function resetPanelWidths() {
    setLeftPanelWidth("18%");
    setRightPanelWidth("25%");
  }

  const loadThreads = useCallback(async () => {
    const data = await fetchThreads();
    setThreads(Array.isArray(data) ? data : []);
  }, []);

  const loadLibrary = useCallback(async () => {
    const [refs, gens, vids] = await Promise.all([
      fetchFiles("references"),
      fetchFiles("generated"),
      fetchFiles("videos"),
    ]);
    setReferences(Array.isArray(refs) ? refs : []);
    setGenerated(Array.isArray(gens) ? gens : []);
    setVideos(Array.isArray(vids) ? vids : []);
  }, []);

  const loadProjects = useCallback(async () => {
    setProjects(await fetchProjects());
  }, []);

  const effectiveActiveProjectId =
    activeProjectId && projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : null;
  const activeProjectRef = useRef<string | null>(effectiveActiveProjectId);

  useEffect(() => {
    activeProjectRef.current = effectiveActiveProjectId;
  }, [effectiveActiveProjectId]);

  const visibleThreads = useMemo(() => {
    const merged = threads.map((thread) => ({
      ...thread,
      history: [...thread.history],
    }));

    for (const generation of pendingGenerations) {
      if (generation.projectId !== effectiveActiveProjectId) continue;
      let thread = merged.find((item) => item.id === generation.threadId);
      if (!thread) {
        thread = {
          id: generation.threadId,
          title:
            generation.entry.prompt.substring(0, 30) +
            (generation.entry.prompt.length > 30 ? "..." : ""),
          history: [],
        };
        merged.push(thread);
      }
      const batchEntryIndex = thread.history.findIndex(
        (entry) => entry.generationBatchId === generation.jobId,
      );
      if (batchEntryIndex >= 0) {
        const persistedEntry = thread.history[batchEntryIndex];
        const referencesByOrder = new Map(
          (generation.entry.references || []).map((reference) => [
            reference.order,
            reference,
          ]),
        );
        for (const reference of persistedEntry.references || []) {
          referencesByOrder.set(reference.order, reference);
        }
        thread.history[batchEntryIndex] = {
          ...persistedEntry,
          references: [...referencesByOrder.values()].sort(
            (a, b) => a.order - b.order,
          ),
          status: generation.entry.status,
          placeholderCount: generation.entry.placeholderCount,
          progress: generation.entry.progress,
          error: generation.entry.error,
        };
      } else {
        thread.history.push(generation.entry);
      }
    }

    return merged;
  }, [effectiveActiveProjectId, pendingGenerations, threads]);

  useEffect(() => {
    setActiveProjectId(effectiveActiveProjectId);
  }, [effectiveActiveProjectId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchSettings(), fetchProjects()]).then(([settings, projectsData]) => {
      if (cancelled) return;

      if (!settings.hasOpenrouterApiKey) setShowSettings(true);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
      setSettingsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    let cancelled = false;

    Promise.all([
      fetchThreads(),
      fetchFiles("references"),
      fetchFiles("generated"),
      fetchFiles("videos"),
      fetchPromptPresets(),
    ]).then(([threadsData, refs, gens, vids, presets]) => {
      if (cancelled) return;

      setThreads(Array.isArray(threadsData) ? threadsData : []);
      setReferences(Array.isArray(refs) ? refs : []);
      setGenerated(Array.isArray(gens) ? gens : []);
      setVideos(Array.isArray(vids) ? vids : []);
      setPresetCategories(Array.isArray(presets) ? presets : []);
      setCurrentThreadId(null);
      setSelectedImages(new Set());
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveActiveProjectId, settingsLoaded]);

  const currentThread = visibleThreads.find((t) => t.id === currentThreadId) || null;
  const activeProject =
    projects.find((p) => p.id === effectiveActiveProjectId) || null;

  // --- Project handlers ---

  async function handleSelectProject(id: string | null) {
    if (id === activeProjectId) return;

    if (id) {
      const project = projects.find((p) => p.id === id);
      if (project?.hasPassword && !unlockedIds.has(id)) {
        const touched = await handleTouchIdUnlock(project);
        if (!touched) setPasswordProject(project);
        return;
      }
    }

    setActiveProject(id);
  }

  async function handleTouchIdUnlock(project: ProjectInfo): Promise<boolean> {
    if (typeof window === "undefined" || !window.electronAPI?.promptTouchID) return false;

    const result = await window.electronAPI.promptTouchID(
      `Разрешите доступ к проекту ${project.name}`,
    );

    if (!result?.ok) return false;

    setUnlockedIds((prev) => new Set(prev).add(project.id));
    setActiveProject(project.id);
    return true;
  }

  async function handleUnlockProject(password: string) {
    if (!passwordProject) return;
    const result = await authProject(passwordProject.id, password);
    if (result.ok) {
      setUnlockedIds((prev) => new Set(prev).add(passwordProject.id));
      setActiveProject(passwordProject.id);
      setPasswordProject(null);
      return;
    }

    setPasswordProject(passwordProject);
  }

  async function handleSaveProject(data: {
    name: string;
    icon: string;
    color: string;
    password?: string;
    removePassword?: boolean;
  }) {
    if (editingProject) {
      await updateProject(editingProject.id, data);
    } else {
      await createProject(data);
    }
    await loadProjects();
    setShowProjectDialog(false);
    setEditingProject(null);
  }

  function handleProjectSettings(project: ProjectInfo) {
    setEditingProject(project);
    setShowProjectDialog(true);
  }

  async function handleDeleteProject(id: string) {
    if (!confirm("Удалить проект и все его данные?")) return;
    if (activeProjectId === id) setActiveProject(null);
    await deleteProject(id);
    await loadProjects();
  }

  // --- Thread handlers ---

  function handleSelectThread(id: string) {
    setCurrentThreadId(id);
  }

  function handleNewChat() {
    setCurrentThreadId(null);
    setSelectedImages(new Set());
  }

  async function handleDeleteThread(id: string) {
    if (!confirm("Удалить этот чат?")) return;
    await deleteThread(id);
    if (currentThreadId === id) setCurrentThreadId(null);
    setPendingGenerations((current) =>
      current.filter(
        (generation) =>
          generation.threadId !== id ||
          generation.projectId !== effectiveActiveProjectId,
      ),
    );
    await loadThreads();
  }

  async function handleClearAll() {
    if (!confirm("Удалить все чаты?")) return;
    await clearAllThreads();
    setCurrentThreadId(null);
    setPendingGenerations((current) =>
      current.filter(
        (generation) => generation.projectId !== effectiveActiveProjectId,
      ),
    );
    await loadThreads();
  }

  function handleToggleSelect(url: string) {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function handleGenerationStarted(generation: PendingGeneration) {
    setPendingGenerations((current) => [...current, generation]);
    setCurrentThreadId(generation.threadId);
    setSelectedImages(new Set());
  }

  function handleGenerationProgress(data: { jobId: string; progress: string }) {
    setPendingGenerations((current) =>
      current.map((generation) =>
        generation.jobId === data.jobId
          ? {
              ...generation,
              entry: { ...generation.entry, progress: data.progress },
            }
          : generation,
      ),
    );
  }

  async function handleGenerationVariantFinished(data: {
    jobId: string;
    projectId: string | null;
  }) {
    if (activeProjectRef.current === data.projectId) {
      await Promise.all([loadThreads(), loadLibrary()]);
    }
    setPendingGenerations((current) =>
      current.map((generation) => {
        if (generation.jobId !== data.jobId) return generation;
        const remaining = Math.max(
          0,
          (generation.entry.placeholderCount || 1) - 1,
        );
        return {
          ...generation,
          entry: {
            ...generation.entry,
            placeholderCount: remaining,
            progress: remaining > 0 ? `Осталось вариантов: ${remaining}` : undefined,
          },
        };
      }),
    );
  }

  async function handleGenerationFinished(data: {
    jobId: string;
    threadId: string;
    projectId: string | null;
    failedCount?: number;
  }) {
    if (activeProjectRef.current === data.projectId) {
      await Promise.all([loadThreads(), loadLibrary()]);
    }
    setPendingGenerations((current) =>
      data.failedCount
        ? current.map((generation) =>
            generation.jobId === data.jobId
              ? {
                  ...generation,
                  entry: {
                    ...generation.entry,
                    status: "failed",
                    placeholderCount: 0,
                    progress: undefined,
                    error: `Готовы не все варианты. Не удалось: ${data.failedCount}.`,
                  },
                }
              : generation,
          )
        : current.filter((generation) => generation.jobId !== data.jobId),
    );
  }

  function handleGenerationFailed(data: { jobId: string; error: string }) {
    setPendingGenerations((current) =>
      current.map((generation) =>
        generation.jobId === data.jobId
          ? {
              ...generation,
              entry: {
                ...generation.entry,
                status: "failed",
                progress: undefined,
                error: data.error,
              },
            }
          : generation,
      ),
    );
  }

  if (!settingsLoaded) return null;

  return (
    <>
      <SettingsDialog
        open={showSettings}
        onSaved={() => setShowSettings(false)}
        onClose={() => setShowSettings(false)}
      />

      <ProjectDialog
        open={showProjectDialog}
        project={editingProject}
        onClose={() => {
          setShowProjectDialog(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        onDelete={async (id) => {
          setShowProjectDialog(false);
          setEditingProject(null);
          await handleDeleteProject(id);
        }}
      />

      <ProjectPasswordDialog
        open={!!passwordProject}
        project={passwordProject}
        onUnlock={handleUnlockProject}
        onCancel={() => setPasswordProject(null)}
      />

      <div
        className="grid h-screen min-w-0 overflow-hidden"
        style={{
          gridTemplateColumns: `${leftPanelWidth} 6px minmax(0, 1fr) 6px ${rightPanelWidth}`,
        }}
      >
        <div className="min-w-0 overflow-hidden">
          <Sidebar
            threads={visibleThreads}
            currentThreadId={currentThreadId}
            onSelectThread={handleSelectThread}
            onNewChat={handleNewChat}
            onDeleteThread={handleDeleteThread}
            onClearAll={handleClearAll}
            projects={projects}
            activeProjectId={effectiveActiveProjectId}
            onSelectProject={handleSelectProject}
            onCreateProject={() => {
              setEditingProject(null);
              setShowProjectDialog(true);
            }}
            onProjectSettings={handleProjectSettings}
            onOpenPresets={() => setShowPromptPresets(true)}
            onOpenSettings={() => setShowSettings(true)}
            onClearAllFiles={async () => {
              if (!confirm("Удалить все файлы проекта (чаты, референсы, генерации)? Это действие необратимо.")) return;
              await Promise.all([
                clearAllThreads(),
                deleteAllImages("references"),
                deleteAllImages("generated"),
                deleteAllImages("videos"),
              ]);
              setCurrentThreadId(null);
              setPendingGenerations((current) =>
                current.filter(
                  (generation) =>
                    generation.projectId !== effectiveActiveProjectId,
                ),
              );
              await Promise.all([loadThreads(), loadLibrary()]);
            }}
          />
        </div>

        <div
          role="separator"
          aria-label="Изменить ширину левой колонки"
          onPointerDown={() => setResizingPanel("left")}
          onDoubleClick={resetPanelWidths}
          className="group relative z-10 cursor-col-resize bg-zinc-200 transition-colors hover:bg-blue-500 dark:bg-zinc-800 dark:hover:bg-blue-500"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        <main className="min-w-0 overflow-y-auto p-6">
          <div className="mx-auto max-w-5xl">
          {showPromptPresets ? (
            <PromptPresets
              categories={presetCategories}
              activeProjectId={effectiveActiveProjectId}
              activeProjectName={activeProject?.name}
              onChange={setPresetCategories}
              onClose={() => setShowPromptPresets(false)}
            />
          ) : (
            <>
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 mb-5 flex items-center gap-3">
            {activeProject && (
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ backgroundColor: activeProject.color }}
              >
                {activeProject.icon}
              </span>
            )}
            {currentThread
              ? currentThread.title
              : activeProject
                ? activeProject.name
                : "Narisuy"}
          </h1>

          <GenerateImage
            key={effectiveActiveProjectId || "global"}
            selectedImages={selectedImages}
            onToggleSelectedImage={handleToggleSelect}
            projectId={effectiveActiveProjectId}
            currentThreadId={currentThreadId}
            presetCategories={presetCategories}
            onOpenPresets={() => setShowPromptPresets(true)}
            onGenerationStarted={handleGenerationStarted}
            onGenerationProgress={handleGenerationProgress}
            onGenerationVariantFinished={handleGenerationVariantFinished}
            onGenerationFinished={handleGenerationFinished}
            onGenerationFailed={handleGenerationFailed}
          />

          <ThreadHistory
            thread={currentThread}
            onImageDeleted={() => {
              loadThreads();
              loadLibrary();
            }}
          />

            </>
          )}
          </div>
        </main>

        <div
          role="separator"
          aria-label="Изменить ширину правой колонки"
          onPointerDown={() => setResizingPanel("right")}
          onDoubleClick={resetPanelWidths}
          className="group relative z-10 cursor-col-resize bg-zinc-200 transition-colors hover:bg-blue-500 dark:bg-zinc-800 dark:hover:bg-blue-500"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        <aside className="min-w-0 overflow-y-auto border-l border-zinc-200 dark:border-zinc-800">
          <ImageLibrary
            references={references}
            generated={generated}
            videos={videos}
            selectedImages={selectedImages}
            onToggleSelect={handleToggleSelect}
            onImagesChanged={loadLibrary}
          />
        </aside>
      </div>
    </>
  );
}
