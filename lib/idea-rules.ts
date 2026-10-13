import type { IdeaCard, IdeaResource } from "./idea-types";

/** Unscheduled generated ideas kept on hand. Scheduled ideas are never removed to make room. */
export const UNSCHEDULED_IDEA_LIMIT = 10;

/** Idea Base items the Custom Idea Base Items mode can use in one generation. */
export const CUSTOM_SELECTION_LIMIT = 10;

export const CUSTOM_ITEMS_HELPER =
  "Selectable items include active and inactive scratch ideas and uploaded files that have been analyzed. Files marked Needs analysis can't be selected until you analyze them in the Idea Base. Choose up to 10.";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Uploaded files with no extracted notes. Scratch ideas are ready without a separate analysis step. */
export function needsAnalysis(resource: Pick<IdeaResource, "inputType" | "extractedNotes">): boolean {
  return resource.inputType === "file" && !resource.extractedNotes.trim();
}

/** Inactive scratch ideas and analyzed files are allowed. Unanalyzed files are not. */
export function isCustomSelectable(resource: Pick<IdeaResource, "inputType" | "extractedNotes" | "active">): boolean {
  return !needsAnalysis(resource);
}

/** Gives saved ideas a stable id and a generation time. Ideas that already have both are returned as-is. */
export function ensureGeneratedIdeaIds(ideas: IdeaCard[], now = Date.now()): IdeaCard[] {
  if (ideas.every((idea) => idea.id && idea.generatedAt != null)) return ideas;
  const known = ideas.map((idea) => idea.generatedAt).filter((value): value is number => value != null);
  const oldestKnown = known.length ? Math.min(...known) : now;
  return ideas.map((idea, index) => ({
    ...idea,
    id: idea.id || newId(),
    generatedAt: idea.generatedAt ?? oldestKnown - (ideas.length - index) * 1000,
  }));
}

export function sameGeneratedIdea(a: IdeaCard, b: IdeaCard): boolean {
  if (a.id && b.id) return a.id === b.id;
  return a.title === b.title && a.cardType === b.cardType && a.cohort === b.cohort && a.topicSummary === b.topicSummary;
}

/**
 * Keeps previously generated ideas, adds the new batch, and drops the oldest unscheduled
 * ideas until only {@link UNSCHEDULED_IDEA_LIMIT} remain. Ids in `keepIds` are never dropped.
 */
export function mergeGeneratedIdeas(
  existing: IdeaCard[],
  incoming: IdeaCard[],
  options?: { now?: number; keepIds?: ReadonlySet<string> },
): IdeaCard[] {
  const now = options?.now ?? Date.now();
  const keep = options?.keepIds ?? new Set<string>();
  const prepared = ensureGeneratedIdeaIds(existing, now - incoming.length - existing.length);
  const fresh = incoming.map((idea, index) => ({
    ...idea,
    id: newId(),
    generatedAt: now + index,
    campaign: undefined,
  }));
  const all = [...prepared, ...fresh];
  const protectedIdeas = all.filter((idea) => idea.id != null && keep.has(idea.id));
  const open = all.filter((idea) => idea.id == null || !keep.has(idea.id));
  open.sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0) || (a.id ?? "").localeCompare(b.id ?? ""));
  const dropped = Math.max(0, open.length - UNSCHEDULED_IDEA_LIMIT);
  const keptOpen = open.slice(dropped);
  return [...keptOpen, ...protectedIdeas].sort((a, b) => (b.generatedAt ?? 0) - (a.generatedAt ?? 0));
}
