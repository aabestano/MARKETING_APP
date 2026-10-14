import { COHORT_FROM_LEGACY, SOURCE_FROM_LEGACY } from "./idea-types";
import type { Campaign, IdeaCard, IdeaResource, PipelineItem, StudioState } from "./idea-types";

type Rec = Record<string, unknown>;

function isRec(v: unknown): v is Rec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Renames one field and remembers the previous value the first time it changes. */
function renameField(obj: Rec, field: "cohort" | "sourceType", map: Record<string, string>): Rec {
  const from = obj[field];
  if (typeof from !== "string") return obj;
  const to = map[from] ?? from;
  if (to === from) return obj;
  const legacyKey = field === "cohort" ? "legacyCohort" : "legacySourceType";
  return typeof obj[legacyKey] === "string" ? { ...obj, [field]: to } : { ...obj, [field]: to, [legacyKey]: from };
}

function migrateResource(item: IdeaResource): IdeaResource {
  return renameField(renameField(item as unknown as Rec, "cohort", COHORT_FROM_LEGACY), "sourceType", SOURCE_FROM_LEGACY) as unknown as IdeaResource;
}

function migrateCard(card: IdeaCard): IdeaCard {
  return renameField(card as unknown as Rec, "cohort", COHORT_FROM_LEGACY) as unknown as IdeaCard;
}

function migrateCampaign(campaign: Campaign): Campaign {
  return renameField(campaign as unknown as Rec, "cohort", COHORT_FROM_LEGACY) as unknown as Campaign;
}

function migratePipeline(item: PipelineItem): PipelineItem {
  const ideaData = migrateCard(item.ideaData);
  const campaign = item.campaign ? migrateCampaign(item.campaign) : item.campaign;
  return ideaData === item.ideaData && campaign === item.campaign ? item : { ...item, ideaData, campaign };
}

function mapList<T>(list: T[] | undefined, fn: (item: T) => T): T[] | undefined {
  if (!Array.isArray(list)) return list;
  let changed = false;
  const next = list.map((item) => {
    const mapped = fn(item);
    if (mapped !== item) changed = true;
    return mapped;
  });
  return changed ? next : list;
}

/** Rewrites saved cohort and source labels. Records are never removed, and the previous label is kept. */
export function applyLabelMigration<T extends Rec>(state: T): T {
  const ideaBase = mapList(state.ideaBase as IdeaResource[] | undefined, migrateResource);
  const pipeline = mapList(state.pipeline as PipelineItem[] | undefined, migratePipeline);
  const generatedIdeas = mapList(state.generatedIdeas as IdeaCard[] | undefined, migrateCard);
  const studio = isRec(state.studio) ? (state.studio as unknown as StudioState) : undefined;
  const campaign = studio?.campaign ? migrateCampaign(studio.campaign) : studio?.campaign;
  const nextStudio = studio && campaign !== studio.campaign ? { ...studio, campaign } : studio;
  if (ideaBase === state.ideaBase && pipeline === state.pipeline && generatedIdeas === state.generatedIdeas && nextStudio === studio) return state;
  return { ...state, ideaBase, pipeline, generatedIdeas, studio: nextStudio };
}

/** Puts a previously renamed label back. Safe to call when nothing was renamed. */
export function restoreLegacyLabel<T extends object>(obj: T, field: "cohort" | "sourceType"): T {
  const rec = obj as Rec;
  const legacyKey = field === "cohort" ? "legacyCohort" : "legacySourceType";
  if (typeof rec[legacyKey] !== "string") return obj;
  const { [legacyKey]: previous, ...rest } = rec;
  return { ...rest, [field]: previous } as T;
}
