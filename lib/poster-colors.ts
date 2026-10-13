import type { ResolvedTokens } from "./brand-tokens";
import { CONTRAST_MIN, contrastRatio, hexToRgb } from "./contrast";
import type { PosterTheme } from "./poster-types";

export const THEME_COLOR_KEYS = ["primary", "accent", "onPrimary", "background", "surface", "text", "muted"] as const;

const SWATCHES: { label: string; key: keyof ResolvedTokens }[] = [
  { label: "Primary", key: "primary" },
  { label: "Secondary", key: "secondary" },
  { label: "Accent", key: "accent" },
  { label: "Text", key: "textColor" },
  { label: "Canvas", key: "canvasBg" },
  { label: "Container", key: "containerBg" },
  { label: "Border", key: "borderColor" },
  { label: "Muted", key: "mutedColor" },
  { label: "Button text", key: "buttonTextColor" },
];

export function expandHex(hex: string): string {
  const h = hex.trim();
  if (/^#[0-9a-f]{3}$/i.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
  return h;
}

/** Unique colors from the selected brand book, in palette order. */
export function brandSwatches(tokens: ResolvedTokens): { hex: string; label: string }[] {
  const seen = new Set<string>();
  const out: { hex: string; label: string }[] = [];
  for (const row of SWATCHES) {
    const raw = tokens[row.key];
    if (typeof raw !== "string" || !hexToRgb(raw)) continue;
    const hex = expandHex(raw);
    const key = hex.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label: row.label, hex });
  }
  return out;
}

/** Copies one chosen color onto every poster color field. */
export function copyColorToTheme(theme: PosterTheme, color: string): PosterTheme {
  const next = { ...theme };
  for (const key of THEME_COLOR_KEYS) next[key] = color;
  return next;
}

function readableOn(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#ffffff";
  const s = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
  return L > 0.42 ? "#0f172a" : "#ffffff";
}

const PAIRS: { fg: string; fgKey: keyof PosterTheme | "button"; bg: string; bgKey: keyof PosterTheme }[] = [
  { fg: "Text", fgKey: "text", bg: "Background", bgKey: "background" },
  { fg: "Text", fgKey: "text", bg: "Cards", bgKey: "surface" },
  { fg: "Muted text", fgKey: "muted", bg: "Background", bgKey: "background" },
  { fg: "Muted text", fgKey: "muted", bg: "Cards", bgKey: "surface" },
  { fg: "Banner text", fgKey: "onPrimary", bg: "Banner background", bgKey: "primary" },
];

/** Non-blocking notes for text and background pairs below 4.5:1. */
export function posterContrastWarnings(theme: PosterTheme): string[] {
  const notes: string[] = [];
  for (const pair of PAIRS) {
    const ratio = contrastRatio(theme[pair.fgKey as keyof PosterTheme], theme[pair.bgKey]);
    if (ratio === null || ratio >= CONTRAST_MIN) continue;
    notes.push(`${pair.fg} on ${pair.bg} is ${ratio.toFixed(1)}:1, below 4.5:1.`);
  }
  const button = readableOn(theme.accent);
  const buttonRatio = contrastRatio(button, theme.accent);
  if (buttonRatio !== null && buttonRatio < CONTRAST_MIN) {
    notes.push(`Button text on Accent and button is ${buttonRatio.toFixed(1)}:1, below 4.5:1.`);
  }
  return notes;
}
