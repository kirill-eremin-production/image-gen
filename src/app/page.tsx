"use client";

import { useEffect, useState, useCallback } from "react";
import { Thread, ImageFile, ProjectInfo } from "@/shared/types";
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
} from "@/shared/api";
import { Sidebar } from "@/widgets/sidebar";
import { GenerateImage } from "@/features/generate-image";
import { ThreadHistory } from "@/widgets/thread-history";
import { ImageLibrary } from "@/widgets/image-library";
import { SettingsDialog } from "@/features/settings-dialog";
import { ProjectDialog } from "@/features/project-dialog";
import { ProjectPasswordDialog } from "@/features/project-password-dialog";

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
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [references, setReferences] = useState<ImageFile[]>([]);
  const [generated, setGenerated] = useState<ImageFile[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

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

  const loadThreads = useCallback(async () => {
    const data = await fetchThreads();
    setThreads(Array.isArray(data) ? data : []);
  }, []);

  const loadLibrary = useCallback(async () => {
    const [refs, gens] = await Promise.all([
      fetchFiles("references"),
      fetchFiles("generated"),
    ]);
    setReferences(Array.isArray(refs) ? refs : []);
    setGenerated(Array.isArray(gens) ? gens : []);
  }, []);

  const loadProjects = useCallback(async () => {
    setProjects(await fetchProjects());
  }, []);

  const effectiveActiveProjectId =
    activeProjectId && projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : null;

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
    ]).then(([threadsData, refs, gens]) => {
      if (cancelled) return;

      setThreads(Array.isArray(threadsData) ? threadsData : []);
      setReferences(Array.isArray(refs) ? refs : []);
      setGenerated(Array.isArray(gens) ? gens : []);
      setCurrentThreadId(null);
      setSelectedImages(new Set());
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveActiveProjectId, settingsLoaded]);

  const currentThread = threads.find((t) => t.id === currentThreadId) || null;
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
    await loadThreads();
  }

  async function handleClearAll() {
    if (!confirm("Удалить все чаты?")) return;
    await clearAllThreads();
    setCurrentThreadId(null);
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

  async function handleGenerated(data: { threadId: string }) {
    setCurrentThreadId(data.threadId);
    setSelectedImages(new Set());
    await Promise.all([loadThreads(), loadLibrary()]);
  }

  if (!settingsLoaded) return null;

  return (
    <div className="flex h-screen">
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

      <Sidebar
        threads={threads}
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
        onOpenSettings={() => setShowSettings(true)}
        onClearAllFiles={async () => {
          if (!confirm("Удалить все файлы проекта (чаты, референсы, генерации)? Это действие необратимо.")) return;
          await Promise.all([
            clearAllThreads(),
            deleteAllImages("references"),
            deleteAllImages("generated"),
          ]);
          setCurrentThreadId(null);
          await Promise.all([loadThreads(), loadLibrary()]);
        }}
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
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
                : "Генератор картинок"}
          </h1>

          <GenerateImage
            selectedImages={selectedImages}
            currentThreadId={currentThreadId}
            onGenerated={handleGenerated}
          />

          <ThreadHistory
            thread={currentThread}
            onImageDeleted={() => {
              loadThreads();
              loadLibrary();
            }}
          />

          <ImageLibrary
            references={references}
            generated={generated}
            selectedImages={selectedImages}
            onToggleSelect={handleToggleSelect}
            onImagesChanged={loadLibrary}
          />
        </div>
      </main>
    </div>
  );
}
