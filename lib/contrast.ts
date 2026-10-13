type RGB = [number, number, number];

function lin(channel: number) {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function lum(rgb: RGB) {
  return 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
}

export function hexToRgb(hex: string): RGB | null {
  const raw = hex.trim().replace(/^#/, "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG contrast ratio. Returns null when either color is not hex. */
export function contrastRatio(a: string, b: string): number | null {
  const left = hexToRgb(a);
  const right = hexToRgb(b);
  if (!left || !right) return null;
  const lighter = Math.max(lum(left), lum(right));
  const darker = Math.min(lum(left), lum(right));
  return (lighter + 0.05) / (darker + 0.05);
}

export const CONTRAST_MIN = 4.5;
