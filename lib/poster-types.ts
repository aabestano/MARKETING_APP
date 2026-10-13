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

export type PosterFixedBlock = "brand" | "headline" | "subheading" | "illustration" | "cta" | "footer";

/** Content blocks. `hidden` keeps the copy but leaves the block out of the preview and exports. */
export type PosterSection = (
  | { type: "steps"; title?: string; style: "flowchart" | "numbered"; items: PosterStep[] }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "callout"; title?: string; body: string }
  | { type: "stats"; title?: string; items: { value: string; label: string }[] }
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
  header: { brandName?: string; tagline?: string; logoAssetId?: string };
  headline: string;
  subheading?: string;
  illustration?: {
    /** library asset to show */
    assetId?: string;
    /** what to draw if nothing in the library fits */
    prompt?: string;
  };
  sections: PosterSection[];
  cta?: { label: string; url?: string; showQr: boolean };
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
