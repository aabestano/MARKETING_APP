import { resolveBrandTokens } from "./brand-tokens";
import { CONTRAST_MIN, contrastRatio } from "./contrast";
import type { BrandTokens } from "./types";

export const EMAIL_COLOR_FIELDS = [
  { key: "primary", label: "Primary" },
  { key: "accent", label: "Accent" },
  { key: "textColor", label: "Text" },
  { key: "canvasBg", label: "Canvas" },
  { key: "containerBg", label: "Container" },
  { key: "mutedColor", label: "Muted" },
  { key: "borderColor", label: "Border" },
] as const satisfies readonly { key: keyof BrandTokens; label: string }[];

export type EmailColorKey = (typeof EMAIL_COLOR_FIELDS)[number]["key"];

/** Copies one color onto the email token fields. Font and other tokens stay as they are. */
export function copyColorToBrandTokens(tokens: BrandTokens, color: string): BrandTokens {
  const next: BrandTokens = { ...tokens };
  for (const field of EMAIL_COLOR_FIELDS) next[field.key] = color;
  return next;
}

/** Notes for email token pairs below 4.5:1. Saving and downloading stay available. */
export function emailContrastWarnings(tokens: BrandTokens | undefined): string[] {
  const resolved = resolveBrandTokens({ tokens });
  const pairs: [string, string, string, string][] = [
    ["Text", resolved.textColor, "Canvas", resolved.canvasBg],
    ["Text", resolved.textColor, "Container", resolved.containerBg],
    ["Muted text", resolved.mutedColor, "Canvas", resolved.canvasBg],
    ["Muted text", resolved.mutedColor, "Container", resolved.containerBg],
    ["Button text", resolved.buttonTextColor, "Accent", resolved.accent],
  ];
  const notes: string[] = [];
  for (const [fg, fgHex, bg, bgHex] of pairs) {
    const ratio = contrastRatio(fgHex, bgHex);
    if (ratio === null || ratio >= CONTRAST_MIN) continue;
    notes.push(`${fg} on ${bg} is ${ratio.toFixed(1)}:1, below 4.5:1.`);
  }
  return notes;
}
