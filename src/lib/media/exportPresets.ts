export type ExportPresetId = "reels" | "small" | "original";
/** For sources that aren't 9:16: "fill" crops to 9:16, "fit" keeps the whole frame with bars. */
export type Framing = "fill" | "fit";

export type ExportPreset = {
  id: ExportPresetId;
  name: string;
  description: string;
  /** Largest 9:16 output; null keeps the source size and shape. */
  box: { width: number; height: number } | null;
  quality: "high" | "medium";
};

export const EXPORT_PRESETS: readonly ExportPreset[] = [
  {
    id: "reels",
    name: "Reels & Shorts",
    description: "9:16, up to 1080×1920, high quality.",
    box: { width: 1080, height: 1920 },
    quality: "high",
  },
  {
    id: "small",
    name: "Smaller file",
    description: "9:16, up to 720×1280. Quicker to send on WhatsApp or a slow connection.",
    box: { width: 720, height: 1280 },
    quality: "medium",
  },
  {
    id: "original",
    name: "Original size",
    description: "Keeps your video's size and shape.",
    box: null,
    quality: "high",
  },
];

/** What the encoder should produce. `fit` uses Mediabunny's names: cover crops, contain adds bars. */
export type ExportPlan = {
  width: number;
  height: number;
  fit: "fill" | "cover" | "contain";
  /** False when the source passes through at its own size. */
  resize: boolean;
  quality: "high" | "medium";
};

const NINE_SIXTEEN = 9 / 16;

/** True when the frame is 9:16 within 2%, the tolerance phones' 1080×1920-ish sizes need. */
export function isNineSixteen(width: number, height: number): boolean {
  return Math.abs(width / height - NINE_SIXTEEN) / NINE_SIXTEEN < 0.02;
}

/** Output size and fitting for a source of `width`×`height` (display size, after rotation). Never upscales. */
export function planExport(
  source: { width: number; height: number },
  presetId: ExportPresetId,
  framing: Framing,
): ExportPlan {
  const preset = EXPORT_PRESETS.find((p) => p.id === presetId) ?? EXPORT_PRESETS[0];
  const { width: sw, height: sh } = source;
  if (!preset.box) return { width: sw, height: sh, fit: "fill", resize: false, quality: preset.quality };
  const box = preset.box;

  if (isNineSixteen(sw, sh)) {
    const scale = Math.min(1, box.width / sw);
    return {
      width: evenFloor(sw * scale),
      height: evenFloor(sh * scale),
      fit: "fill",
      resize: scale < 1,
      quality: preset.quality,
    };
  }

  if (framing === "fit") {
    // A 9:16 canvas as wide as the source allows (capped at the box), the whole frame inside it.
    const width = evenFloor(Math.min(box.width, sw));
    return { width, height: evenFloor((width * 16) / 9), fit: "contain", resize: true, quality: preset.quality };
  }

  // Fill: the largest centred 9:16 region of the source, scaled down to the box if needed.
  const regionHeight = Math.min(sh, sw / NINE_SIXTEEN);
  const height = evenFloor(Math.min(regionHeight, box.height));
  return { width: evenFloor(height * NINE_SIXTEEN), height, fit: "cover", resize: true, quality: preset.quality };
}

function evenFloor(n: number): number {
  return Math.max(2, 2 * Math.floor(n / 2));
}
