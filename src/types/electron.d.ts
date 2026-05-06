export interface TouchIDPromptResult {
  ok: boolean;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      promptTouchID: (reason: string) => Promise<TouchIDPromptResult>;
    };
  }
}

export {};
