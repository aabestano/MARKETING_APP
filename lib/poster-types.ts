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

/** Per-part color overrides; any role left out falls back to the poster theme. */
export type ColorOverrides = Partial<PosterTheme>;

export type PosterSection =
  | { type: "steps"; title?: string; style: "flowchart" | "numbered"; items: PosterStep[]; colors?: ColorOverrides }
  | { type: "bullets"; title?: string; items: string[]; colors?: ColorOverrides }
  | { type: "callout"; title?: string; body: string; colors?: ColorOverrides }
  | { type: "stats"; title?: string; items: { value: string; label: string }[]; colors?: ColorOverrides };

export interface PosterSpec {
  version: 1;
  theme: PosterTheme;
  /** requested font family; resolved against uploaded fonts with a closest-match fallback */
  fontFamily?: string;
  header: { brandName?: string; tagline?: string; logoAssetId?: string; colors?: ColorOverrides };
  headline: string;
  subheading?: string;
  illustration?: {
    /** library asset to show */
    assetId?: string;
    /** what to draw if nothing in the library fits */
    prompt?: string;
  };
  sections: PosterSection[];
  cta?: { label: string; url?: string; showQr: boolean; colors?: ColorOverrides };
  footer?: { text?: string; disclaimer?: string; colors?: ColorOverrides };
}

export type SizeUnit = "mm" | "in" | "px";

export interface PosterSize {
  presetId: string;
  width: number;
  height: number;
  unit: SizeUnit;
  bleedMm: number;
}

export type IllustrationMode = "auto" | "library" | "none";

export interface PosterWorkspace {
  prompt: string;
  spec: PosterSpec | null;
  size: PosterSize;
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
