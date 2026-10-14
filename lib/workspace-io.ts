import { APP_NAME, APP_NAME_LIMIT } from "./app-name";
import { normalizePurposes } from "./assets";
import { applyLabelMigration } from "./label-migration";
import { SECTIONS, orderedSectionIds, orderedTabIds } from "./nav";
import { UI_COPY, cleanCopyText, type CopyKey } from "./ui-copy";
import type { BrandAsset, BrandBook, SavedBlast, SectionId, Settings, TabId, Theme } from "./types";
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

function cleanDisplayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.trim().replace(/\s+/g, " ").slice(0, APP_NAME_LIMIT).trim();
  return name || undefined;
}

/** Keeps only real tabs, and only inside the section they belong to. */
function cleanTabOrder(value: unknown): Settings["tabOrder"] | undefined {
  if (!isObj(value)) return undefined;
  const out: Partial<Record<SectionId, TabId[]>> = {};
  for (const section of SECTIONS) {
    const raw = value[section.id];
    if (!Array.isArray(raw)) continue;
    const ids = raw.filter((id): id is TabId => typeof id === "string");
    out[section.id] = orderedTabIds(section.id, { [section.id]: ids });
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanSectionOrder(value: unknown): SectionId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ids = value.filter((id): id is SectionId => id === "plan" || id === "create" || id === "library");
  return ids.length ? orderedSectionIds(ids) : undefined;
}

function cleanCopyOverrides(value: unknown): Settings["copyOverrides"] | undefined {
  if (!isObj(value)) return undefined;
  const out: Partial<Record<CopyKey, string>> = {};
  for (const key of Object.keys(UI_COPY) as CopyKey[]) {
    const raw = value[key];
    if (typeof raw !== "string") continue;
    const text = cleanCopyText(raw, UI_COPY[key].limit);
    if (text) out[key] = text;
  }
  return Object.keys(out).length ? out : undefined;
}

function cleanSettings(value: unknown): WorkspaceData["settings"] {
  const settings: Partial<Settings> = isObj(value) ? { ...(value as Partial<Settings>) } : {};
  delete settings.geminiApiKey;
  delete settings.mailerApiKey;
  delete settings.fluxApiKey;
  const displayName = cleanDisplayName(settings.displayName);
  if (displayName) settings.displayName = displayName;
  else delete settings.displayName;
  const tabOrder = cleanTabOrder(settings.tabOrder);
  if (tabOrder) settings.tabOrder = tabOrder;
  else delete settings.tabOrder;
  const sectionOrder = cleanSectionOrder(settings.sectionOrder);
  if (sectionOrder) settings.sectionOrder = sectionOrder;
  else delete settings.sectionOrder;
  if (settings.createBrandBookId === null) {
    settings.createBrandBookId = null;
  } else if (typeof settings.createBrandBookId === "string" && settings.createBrandBookId.trim()) {
    settings.createBrandBookId = settings.createBrandBookId.trim();
  } else {
    delete settings.createBrandBookId;
  }
  const copyOverrides = cleanCopyOverrides(settings.copyOverrides);
  if (copyOverrides) settings.copyOverrides = copyOverrides;
  else delete settings.copyOverrides;
  return settings as WorkspaceData["settings"];
}

/** Parses and validates an export file. Throws an Error with a user-readable message on bad input. */
export function parseWorkspaceExport(text: string, appName = APP_NAME): WorkspaceExport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Choose a workspace file exported from this app.");
  }
  if (!isObj(raw) || raw.app !== EXPORT_APP || !isObj(raw.data)) {
    throw new Error(`That file isn't an ${appName} workspace export.`);
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
  const settings = cleanSettings(d.settings);
  const theme: Theme = d.theme === "light" ? "light" : "dark";
  const labels = applyLabelMigration({ ideaBase, pipeline });
  return {
    app: EXPORT_APP,
    version: typeof raw.version === "number" ? raw.version : EXPORT_VERSION,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "",
    data: { brandBooks, assets, blasts, posters, ideaBase: labels.ideaBase, pipeline: labels.pipeline, settings, theme },
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
