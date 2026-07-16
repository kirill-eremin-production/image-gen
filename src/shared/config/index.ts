export type MediaType = "image" | "video";

export interface ModelConfig {
  value: string;
  label: string;
  resolutions: readonly string[];
  aspectRatios: readonly string[];
  durations?: readonly number[];
}

export const IMAGE_MODELS: readonly ModelConfig[] = [
  {
    value: "google/gemini-3.1-flash-lite-image",
    label: "Gemini 3.1 Flash Lite Image",
    resolutions: ["1K"],
    aspectRatios: [
      "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1",
      "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ],
  },
  {
    value: "google/gemini-3.1-flash-image",
    label: "Gemini 3.1 Flash Image",
    resolutions: ["512", "1K", "2K", "4K"],
    aspectRatios: [
      "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1",
      "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9",
    ],
  },
  {
    value: "google/gemini-3-pro-image",
    label: "Gemini 3 Pro Image",
    resolutions: ["1K", "2K", "4K"],
    aspectRatios: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
  },
] as const;

export const VIDEO_MODELS: readonly ModelConfig[] = [
  {
    value: "google/veo-3.1",
    label: "Veo 3.1",
    resolutions: ["720p", "1080p", "4K"],
    aspectRatios: ["16:9", "9:16"],
    durations: [4, 6, 8],
  },
  {
    value: "google/veo-3.1-lite",
    label: "Veo 3.1 Lite",
    resolutions: ["720p", "1080p"],
    aspectRatios: ["16:9", "9:16"],
    durations: [4, 6, 8],
  },
  {
    value: "google/veo-3.1-fast",
    label: "Veo 3.1 Fast",
    resolutions: ["720p", "1080p", "4K"],
    aspectRatios: ["16:9", "9:16"],
    durations: [4, 6, 8],
  },
] as const;

// Kept for callers that still import the old image-only constants.
export const MODELS = IMAGE_MODELS;
export const RESOLUTIONS = ["512", "1K", "2K", "4K"] as const;
export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
