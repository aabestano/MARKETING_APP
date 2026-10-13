import type { PosterSize, SizeUnit } from "./poster-types";

export const CSS_DPI = 96;
const MM_PER_IN = 25.4;

export interface SizePreset {
  id: string;
  label: string;
  group: "Print" | "Social";
  width: number;
  height: number;
  unit: SizeUnit;
  bleedMm: number;
}

export const SIZE_PRESETS: SizePreset[] = [
  { id: "a4", label: "A4 (210 × 297 mm)", group: "Print", width: 210, height: 297, unit: "mm", bleedMm: 3 },
  { id: "a3", label: "A3 (297 × 420 mm)", group: "Print", width: 297, height: 420, unit: "mm", bleedMm: 3 },
  { id: "a2", label: "A2 (420 × 594 mm)", group: "Print", width: 420, height: 594, unit: "mm", bleedMm: 3 },
  { id: "letter", label: "Letter (8.5 × 11 in)", group: "Print", width: 8.5, height: 11, unit: "in", bleedMm: 3 },
  { id: "ig-post", label: "Instagram post (1080 × 1350 px)", group: "Social", width: 1080, height: 1350, unit: "px", bleedMm: 0 },
  { id: "ig-story", label: "Instagram story (1080 × 1920 px)", group: "Social", width: 1080, height: 1920, unit: "px", bleedMm: 0 },
  { id: "fb-post", label: "Facebook post (1200 × 630 px)", group: "Social", width: 1200, height: 630, unit: "px", bleedMm: 0 },
];

export const CUSTOM_PRESET_ID = "custom";

export const DEFAULT_SIZE: PosterSize = {
  presetId: "a4",
  width: 210,
  height: 297,
  unit: "mm",
  bleedMm: 3,
};

export function sizeFromPreset(id: string): PosterSize {
  const p = SIZE_PRESETS.find((x) => x.id === id) ?? SIZE_PRESETS[0];
  return { presetId: p.id, width: p.width, height: p.height, unit: p.unit, bleedMm: p.bleedMm };
}

export function unitToPx(value: number, unit: SizeUnit): number {
  if (unit === "mm") return (value / MM_PER_IN) * CSS_DPI;
  if (unit === "in") return value * CSS_DPI;
  return value;
}

export function pxToMm(px: number): number {
  return (px / CSS_DPI) * MM_PER_IN;
}

export function mmToPx(mm: number): number {
  return (mm / MM_PER_IN) * CSS_DPI;
}

const LIMITS: Record<SizeUnit, [number, number]> = {
  mm: [40, 1200],
  in: [1.5, 48],
  px: [200, 6000],
};

export function clampDimension(value: number, unit: SizeUnit): number {
  const [min, max] = LIMITS[unit];
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sanitizeSize(input: Partial<PosterSize> | undefined): PosterSize {
  const unit: SizeUnit = input?.unit === "in" || input?.unit === "px" || input?.unit === "mm" ? input.unit : DEFAULT_SIZE.unit;
  const width = clampDimension(Number(input?.width ?? DEFAULT_SIZE.width), unit);
  const height = clampDimension(Number(input?.height ?? DEFAULT_SIZE.height), unit);
  const bleed = Number(input?.bleedMm ?? 0);
  return {
    presetId: typeof input?.presetId === "string" ? input.presetId : CUSTOM_PRESET_ID,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    unit,
    bleedMm: Number.isFinite(bleed) ? Math.min(10, Math.max(0, Math.round(bleed * 10) / 10)) : 0,
  };
}

/** Trim size in CSS pixels (96 per inch). */
export function trimPx(size: PosterSize): { w: number; h: number } {
  return { w: Math.round(unitToPx(size.width, size.unit)), h: Math.round(unitToPx(size.height, size.unit)) };
}

export function trimMm(size: PosterSize): { w: number; h: number } {
  const { w, h } = trimPx(size);
  return { w: pxToMm(w), h: pxToMm(h) };
}

export function swapOrientation(size: PosterSize): PosterSize {
  return { ...size, width: size.height, height: size.width };
}

export function describeSize(size: PosterSize): string {
  const fmt = (n: number) => String(Math.round(n * 100) / 100);
  return `${fmt(size.width)} × ${fmt(size.height)} ${size.unit}`;
}

export const isPrintSize = (size: PosterSize) => size.unit !== "px";

export const MAX_EXPORT_PIXELS = 24_000_000;

/** Pixel ratio for a target DPI, reduced if the bitmap would exceed browser canvas limits. */
export function exportPixelRatio(totalCssW: number, totalCssH: number, dpi: number): { ratio: number; effectiveDpi: number; clamped: boolean } {
  const wanted = dpi / CSS_DPI;
  const maxByArea = Math.sqrt(MAX_EXPORT_PIXELS / Math.max(1, totalCssW * totalCssH));
  const maxByEdge = 16000 / Math.max(totalCssW, totalCssH);
  const ratio = Math.max(0.25, Math.min(wanted, maxByArea, maxByEdge));
  return { ratio, effectiveDpi: Math.round(ratio * CSS_DPI), clamped: ratio < wanted - 1e-6 };
}
