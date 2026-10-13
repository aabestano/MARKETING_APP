import { normalizePurposes } from "./assets";
import type { BrandAsset, BrandBook, SavedBlast, Settings, Theme } from "./types";
import type { IdeaResource, PipelineItem } from "./idea-types";
import type { SavedPoster } from "./poster-types";

export const EXPORT_APP = "brand-engine";
export const EXPORT_VERSION = 1;

/** Everything that travels between workspaces. API keys are deliberately never included. */
export interface WorkspaceData {
  brandBooks: BrandBook[];
  assets: BrandAsset[];
  blasts: SavedBlast[];
  posters: SavedPoster[];
  ideaBase: IdeaResource[];
  pipeline: PipelineItem[];
  settings: Omit<Settings, "geminiApiKey" | "mailerApiKey" | "fluxApiKey">;
  theme: Theme;
}

export interface WorkspaceExport {
  app: typeof EXPORT_APP;
  version: number;
  exportedAt: string;
  data: WorkspaceData;
}

export type ImportMode = "merge" | "replace";

export function buildExport(input: {
  brandBooks: BrandBook[];
  assets: BrandAsset[];
  blasts: SavedBlast[];
  posters?: SavedPoster[];
  ideaBase?: IdeaResource[];
  pipeline?: PipelineItem[];
  settings: Settings;
  theme: Theme;
}): WorkspaceExport {
  const safeSettings: Partial<Settings> = { ...input.settings };
  delete safeSettings.geminiApiKey;
  delete safeSettings.mailerApiKey;
  delete safeSettings.fluxApiKey;
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      brandBooks: input.brandBooks,
      assets: input.assets,
      blasts: input.blasts,
      posters: input.posters ?? [],
      ideaBase: input.ideaBase ?? [],
      pipeline: input.pipeline ?? [],
      settings: safeSettings as WorkspaceData["settings"],
      theme: input.theme,
    },
  };
}

export function exportFilename(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `brand-engine-workspace-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function list<T>(value: unknown, valid: (item: Record<string, unknown>) => boolean): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => isObj(item) && valid(item)) as unknown as T[];
}

/** Parses and validates an export file. Throws an Error with a user-readable message on bad input. */
export function parseWorkspaceExport(text: string): WorkspaceExport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Choose a workspace file exported from this app.");
  }
  if (!isObj(raw) || raw.app !== EXPORT_APP || !isObj(raw.data)) {
    throw new Error("That file isn't a Brand Engine workspace export.");
  }
  if (typeof raw.version === "number" && raw.version > EXPORT_VERSION) {
    throw new Error("This export was made by a newer version of the app. Update the app and try again.");
  }
  const d = raw.data;
  const brandBooks = list<BrandBook>(d.brandBooks, (b) => typeof b.id === "string" && typeof b.name === "string");
  const assets = list<BrandAsset>(d.assets, (a) => typeof a.id === "string" && typeof a.bookId === "string" && typeof a.name === "string").map(
    (a) => ({ ...a, purposes: normalizePurposes(a.purposes) }),
  );
  const blasts = list<SavedBlast>(d.blasts, (b) => typeof b.id === "string" && typeof b.html === "string");
  const posters = list<SavedPoster>(d.posters, (p) => typeof p.id === "string" && isObj(p.spec) && isObj(p.size));
  const ideaBase = list<IdeaResource>(d.ideaBase, (r) => typeof r.id === "string" && typeof r.name === "string");
  const pipeline = list<PipelineItem>(d.pipeline, (p) => typeof p.id === "string" && typeof p.scheduledDate === "string" && isObj(p.ideaData));
  const settings = isObj(d.settings) ? (d.settings as unknown as WorkspaceData["settings"]) : ({} as WorkspaceData["settings"]);
  const theme: Theme = d.theme === "light" ? "light" : "dark";
  return {
    app: EXPORT_APP,
    version: typeof raw.version === "number" ? raw.version : EXPORT_VERSION,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    data: { brandBooks, assets, blasts, posters, ideaBase, pipeline, settings, theme },
  };
}

export function summarizeExport(data: WorkspaceData): { label: string; count: number }[] {
  return [
    { label: "brand books", count: data.brandBooks.length },
    { label: "assets", count: data.assets.length },
    { label: "saved blasts", count: data.blasts.length },
    { label: "saved posters", count: data.posters.length },
    { label: "idea base items", count: data.ideaBase.length },
    { label: "calendar items", count: data.pipeline.length },
  ];
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const incomingIds = new Set(incoming.map((i) => i.id));
  return [...current.filter((c) => !incomingIds.has(c.id)), ...incoming];
}

export interface CurrentData {
  brandBooks: BrandBook[];
  assets: BrandAsset[];
  blasts: SavedBlast[];
  posters: SavedPoster[];
  ideaBase: IdeaResource[];
  pipeline: PipelineItem[];
}

/** Computes the collections to write back to the store for an import. Settings and theme are applied separately. */
export function applyImport(current: CurrentData, incoming: WorkspaceData, mode: ImportMode): CurrentData {
  if (mode === "replace") {
    return {
      brandBooks: incoming.brandBooks,
      assets: incoming.assets,
      blasts: incoming.blasts,
      posters: incoming.posters,
      ideaBase: incoming.ideaBase,
      pipeline: incoming.pipeline,
    };
  }
  const brandBooks = mergeById(current.brandBooks, incoming.brandBooks);
  const bookIds = new Set(brandBooks.map((b) => b.id));
  const assets = mergeById(current.assets, incoming.assets).filter((a) => bookIds.has(a.bookId));
  return {
    brandBooks,
    assets,
    blasts: mergeById(current.blasts, incoming.blasts),
    posters: mergeById(current.posters, incoming.posters),
    ideaBase: mergeById(current.ideaBase, incoming.ideaBase),
    pipeline: mergeById(current.pipeline, incoming.pipeline),
  };
}
