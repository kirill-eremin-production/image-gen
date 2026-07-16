export interface ImageFile {
  name: string;
  url: string;
  kind?: "image" | "video";
}

export interface HistoryEntry {
  timestamp: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
  images: ImageFile[];
  videos?: ImageFile[];
  mediaType?: "image" | "video";
  model?: string;
  duration?: number;
  generateAudio?: boolean;
  seed?: number | null;
  negativePrompt?: string;
  videoJobId?: string;
  cost: number | null;
}

export interface Thread {
  id: string;
  title: string;
  history: HistoryEntry[];
}

export interface Settings {
  openrouterApiKey: string;
}

export interface SettingsState {
  hasOpenrouterApiKey: boolean;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  color: string;
  passwordHash: string | null;
}

export interface ProjectInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  hasPassword: boolean;
}

export type PromptPresetScope = "global" | "project";

export interface PromptPresetVariant {
  id: string;
  name: string;
  prompt: string;
}

export interface PromptPresetCategory {
  id: string;
  name: string;
  scope: PromptPresetScope;
  projectId: string | null;
  variants: PromptPresetVariant[];
}

export interface GenerateParams {
  mediaType: "image" | "video";
  prompt: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  references: string[];
  threadId: string | null;
  duration?: number;
  generateAudio?: boolean;
  seed?: number | null;
  negativePrompt?: string;
  enhancePrompt?: boolean;
  referenceMode?: "reference" | "frames";
  action?: "submit" | "poll";
  jobId?: string;
  pollingUrl?: string;
}
