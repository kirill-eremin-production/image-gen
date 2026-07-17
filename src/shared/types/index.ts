export interface ImageFile {
  name: string;
  url: string;
  kind?: "image" | "video";
}

export type GenerationReferenceRole =
  | "primary"
  | "secondary"
  | "first_frame"
  | "last_frame";

export interface GenerationReference {
  name: string;
  url: string;
  type: "references" | "generated" | "external";
  source: "library" | "upload" | "external";
  order: number;
  role: GenerationReferenceRole;
}

export interface HistoryEntry {
  id?: string;
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
  generationBatchId?: string;
  references?: GenerationReference[];
  status?: "pending" | "failed";
  placeholderCount?: number;
  progress?: string;
  error?: string;
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
  submittedAt?: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  variantCount?: number;
  generationBatchId?: string;
  saveReferences?: boolean;
  references: string[];
  referenceFiles?: GenerationReference[];
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
