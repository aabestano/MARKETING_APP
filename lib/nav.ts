import type { SectionId, TabId } from "./types";

export interface NavTab {
  id: TabId;
  label: string;
}

export interface NavSection {
  id: SectionId;
  label: string;
  hint: string;
  tabs: NavTab[];
}

export const SECTIONS: NavSection[] = [
  {
    id: "plan",
    label: "Plan",
    hint: "Calendar and saved designs",
    tabs: [
      { id: "calendar", label: "Calendar" },
      { id: "repository", label: "Design Repository" },
    ],
  },
  {
    id: "create",
    label: "Create",
    hint: "Ideas, studio, and designs",
    tabs: [
      { id: "idea-generator", label: "Idea Generator" },
      { id: "idea-studio", label: "Idea Studio" },
      { id: "design-studio", label: "Design Studio" },
    ],
  },
  {
    id: "library",
    label: "Library",
    hint: "Idea Base and Brand Books",
    tabs: [
      { id: "idea-base", label: "Idea Base" },
      { id: "brands", label: "Brand Books" },
    ],
  },
];

export function sectionOf(tab: TabId): NavSection {
  return SECTIONS.find((s) => s.tabs.some((t) => t.id === tab)) ?? SECTIONS[2];
}

const sectionById = (id: SectionId) => SECTIONS.find((s) => s.id === id) ?? SECTIONS[0];

/** Tabs for one section, in the saved order. Unknown ids are dropped. Missing defaults are appended. */
export function orderedTabIds(sectionId: SectionId, order?: Partial<Record<SectionId, TabId[]>> | null): TabId[] {
  const defaults = sectionById(sectionId).tabs.map((t) => t.id);
  const allowed = new Set(defaults);
  const seen = new Set<TabId>();
  const out: TabId[] = [];
  for (const id of order?.[sectionId] ?? []) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function orderedTabs(sectionId: SectionId, order?: Partial<Record<SectionId, TabId[]>> | null): NavTab[] {
  const byId = new Map(sectionById(sectionId).tabs.map((t) => [t.id, t]));
  return orderedTabIds(sectionId, order).map((id) => byId.get(id)!);
}

/** Swap a tab one step inside its own list. Returns the same array when the move is not possible. */
export function moveTab(ids: TabId[], id: TabId, dir: -1 | 1): TabId[] {
  const index = ids.indexOf(id);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  const copy = ids.slice();
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}
