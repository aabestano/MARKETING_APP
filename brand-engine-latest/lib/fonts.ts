import type { BrandAsset } from "./types";

export interface ParsedFontName {
  family: string;
  weight: number;
  style: "normal" | "italic";
}

const WEIGHTS: [RegExp, number][] = [
  [/extra[-\s]?bold|ultra[-\s]?bold|heavy|black/i, 900],
  [/semi[-\s]?bold|demi[-\s]?bold/i, 600],
  [/bold/i, 700],
  [/medium/i, 500],
  [/extra[-\s]?light|ultra[-\s]?light|thin|hairline/i, 200],
  [/light/i, 300],
];

/** "Montserrat-SemiBoldItalic.ttf" -> { family: "Montserrat", weight: 600, style: "italic" } */
export function parseFontFileName(fileName: string): ParsedFontName {
  const base = fileName.replace(/\.[a-z0-9]+$/i, "");
  const italic = /italic|oblique/i.test(base);
  let weight = 400;
  for (const [re, w] of WEIGHTS) {
    if (re.test(base)) {
      weight = w;
      break;
    }
  }
  const family = base
    .replace(/[-_](regular|italic|oblique|bold|semibold|extrabold|medium|light|extralight|thin|black|heavy)+.*$/i, "")
    .replace(/(regular|italic|oblique|bold|semibold|extrabold|medium|light|extralight|thin|black|heavy)+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return { family: family || base, weight, style: italic ? "italic" : "normal" };
}

const FORMAT_BY_EXT: Record<string, string> = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };

export function fontFormat(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return FORMAT_BY_EXT[ext] ?? "truetype";
}

export function fontAssets(assets: BrandAsset[]): BrandAsset[] {
  return assets.filter((a) => a.kind === "font" && a.dataUrl && a.fontFamily);
}

export function fontFamilies(assets: BrandAsset[]): string[] {
  return Array.from(new Set(fontAssets(assets).map((a) => a.fontFamily as string)));
}

const q = (s: string) => `'${s.replace(/['\\]/g, "")}'`;

/** @font-face rules for uploaded fonts. Used for on-screen display, PNG/PDF embedding and the print window. */
export function buildFontFaceCss(assets: BrandAsset[]): string {
  return fontAssets(assets)
    .map(
      (a) =>
        `@font-face{font-family:${q(a.fontFamily as string)};font-weight:${a.fontWeight ?? 400};font-style:${a.fontStyle ?? "normal"};font-display:block;src:url(${a.dataUrl}) format('${fontFormat(a.name)}');}`,
    )
    .join("\n");
}

type FontClass = { id: string; names: RegExp; stack: string };

const CLASSES: FontClass[] = [
  { id: "mono", names: /courier|consolas|menlo|monaco|mono|code/i, stack: "'Courier New',Courier,monospace" },
  { id: "script", names: /script|brush|cursive|pacifico|lobster|dancing|signature|handwrit/i, stack: "'Brush Script MT','Segoe Script','Comic Sans MS',cursive" },
  {
    id: "serif",
    names: /georgia|times|garamond|playfair|merriweather|lora|cambria|baskerville|palatino|bookman|caslon|serif(?!.*sans)/i,
    stack: "Georgia,'Times New Roman',Times,serif",
  },
  { id: "condensed", names: /impact|bebas|oswald|anton|condensed|narrow|league gothic/i, stack: "Impact,'Arial Narrow Bold','Haettenschweiler',sans-serif" },
  {
    id: "geometric",
    names: /montserrat|poppins|raleway|futura|avenir|gotham|century gothic|josefin|nunito|quicksand|varela|dm sans|urbanist|lexend/i,
    stack: "'Century Gothic','Avenir Next',Avenir,'Trebuchet MS',Verdana,sans-serif",
  },
  {
    id: "humanist",
    names: /open sans|lato|source sans|segoe|calibri|myriad|noto sans|fira sans|ubuntu|cabin|work sans/i,
    stack: "'Segoe UI','Open Sans',Calibri,'Helvetica Neue',Arial,sans-serif",
  },
  { id: "grotesque", names: /helvetica|arial|inter|roboto|sf pro|system-ui|sans-serif|verdana|tahoma/i, stack: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
];

export const DEFAULT_FONT_STACK = "'Helvetica Neue',Helvetica,Arial,sans-serif";

export interface ResolvedFont {
  stack: string;
  /** uploaded: a brand font file matched; closest: mapped to a similar system font; default: nothing requested */
  match: "uploaded" | "closest" | "default";
  family?: string;
}

function splitFamilies(requested: string): string[] {
  return requested
    .split(",")
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

/**
 * Picks the font stack for a poster: an uploaded brand font if one matches (case-insensitive),
 * otherwise the closest system-font look, otherwise the first uploaded font, otherwise a neutral sans.
 */
export function resolveFontStack(requested: string | undefined, uploadedFamilies: string[]): ResolvedFont {
  const wanted = splitFamilies(requested ?? "");
  for (const w of wanted) {
    const hit = uploadedFamilies.find((u) => u.toLowerCase() === w.toLowerCase());
    if (hit) return { stack: `${q(hit)},${DEFAULT_FONT_STACK}`, match: "uploaded", family: hit };
  }
  if (!wanted.length) {
    if (uploadedFamilies.length) return { stack: `${q(uploadedFamilies[0])},${DEFAULT_FONT_STACK}`, match: "uploaded", family: uploadedFamilies[0] };
    return { stack: DEFAULT_FONT_STACK, match: "default" };
  }
  for (const w of wanted) {
    const cls = CLASSES.find((c) => c.names.test(w));
    if (cls) return { stack: `${q(w)},${cls.stack}`, match: "closest", family: w };
  }
  return { stack: `${q(wanted[0])},${DEFAULT_FONT_STACK}`, match: "closest", family: wanted[0] };
}
