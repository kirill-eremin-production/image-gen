export interface ImageFile {
  name: string;
  url: string;
}

export interface HistoryEntry {
  timestamp: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
  images: ImageFile[];
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

export interface GenerateParams {
  prompt: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  references: string[];
  threadId: string | null;
}
