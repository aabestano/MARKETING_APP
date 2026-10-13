import type { HeroSize, PosterLayout } from "./poster-blocks";

export interface PosterTheme {
  background: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  onPrimary: string;
}

export interface PosterStep {
  label: string;
  detail?: string;
  /** Renders the step as a yes/no decision node with two branches */
  decision?: { yes?: string; no?: string };
}

/** Icons drawn on the poster as vectors, so PNG, PDF, and Vector PDF all include them. */
export const TIP_ICONS = ["lightbulb", "drop", "sun", "heart-pulse", "pill", "none"] as const;
export type TipIcon = (typeof TIP_ICONS)[number];

export const TIP_ICON_LABEL: Record<TipIcon, string> = {
  lightbulb: "Lightbulb",
  drop: "Drop",
  sun: "Sun",
  "heart-pulse": "Heart pulse",
  pill: "Pill",
  none: "None",
};

export function tipIconFrom(value: unknown): TipIcon {
  if (typeof value !== "string") return "none";
  const key = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (key === "heartpulse") return "heart-pulse";
  return (TIP_ICONS as readonly string[]).includes(key) ? (key as TipIcon) : "none";
}

export interface PosterTip {
  text: string;
  icon: TipIcon;
}

export type PosterFixedBlock = "brand" | "headline" | "subheading" | "illustration" | "cta" | "footer";

/** Content blocks. `hidden` keeps the copy but leaves the block out of the preview and exports. */
export type PosterSection = (
  | { type: "steps"; title?: string; style: "flowchart" | "numbered"; items: PosterStep[] }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "callout"; title?: string; body: string }
  | { type: "stats"; title?: string; items: { value: string; label: string }[] }
  | { type: "tips"; title?: string; items: PosterTip[] }
) & { hidden?: boolean };

export interface PosterSpec {
  version: 1;
  theme: PosterTheme;
  /** Block order and which blocks sit in the banner. Omitted specs use the default header band. */
  layout?: PosterLayout;
  /** Fixed blocks left out of the preview and exports. Section visibility lives on each section. */
  hiddenBlocks?: PosterFixedBlock[];
  /** requested font family; resolved against uploaded fonts with a closest-match fallback */
  fontFamily?: string;
  header: { brandName?: string; tagline?: string; logoAssetId?: string; secondLogoAssetId?: string; pill?: string };
  headline: string;
  subheading?: string;
  illustration?: {
    /** library asset to show */
    assetId?: string;
    /** what to draw if nothing in the library fits */
    prompt?: string;
  };
  sections: PosterSection[];
  cta?: { label: string; url?: string; showQr: boolean; qrCaption?: string };
  footer?: { text?: string; disclaimer?: string };
}

export type SizeUnit = "mm" | "in" | "px";

export interface PosterSize {
  presetId: string;
  width: number;
  height: number;
  unit: SizeUnit;
  bleedMm: number;
}

export type IllustrationMode = "auto" | "library" | "none" | "draw";

export interface PosterWorkspace {
  prompt: string;
  /** Editable layout directions. Generate poster uses this when it has text, and the brief when it is empty. */
  layoutPrompt?: string;
  spec: PosterSpec | null;
  size: PosterSize;
  /** Share of the poster height given to the picture. Defaults to medium. */
  heroSize?: HeroSize;
  illustrationMode: IllustrationMode;
  source: "gemini" | "fallback" | "manual" | null;
  warnings: string[];
  /** repository poster this workspace was opened from; Save updates it instead of duplicating */
  savedId: string | null;
  /** calendar item this poster was started from; saving attaches the poster to it */
  pipelineId?: string | null;
}

export interface SavedPoster {
  id: string;
  name: string;
  brandBookId: string | null;
  brandBookName: string;
  spec: PosterSpec;
  size: PosterSize;
  prompt: string;
  /** small PNG preview captured at save time */
  thumbnail?: string;
  createdAt: number;
  updatedAt: number;
}
