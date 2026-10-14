import type { CopyKey } from "./ui-copy";
import type { SectionId, TabId } from "./types";

export interface NavTab {
  id: TabId;
  label: string;
  copyKey: CopyKey;
}

export interface NavSection {
  id: SectionId;
  label: string;
  hint: string;
  labelKey: CopyKey;
  hintKey: CopyKey;
  tabs: NavTab[];
}

export const SECTIONS: NavSection[] = [
  {
    id: "plan",
    label: "Plan",
    hint: "Calendar",
    labelKey: "nav.plan",
    hintKey: "nav.plan.hint",
    tabs: [{ id: "calendar", label: "Calendar", copyKey: "tab.calendar" }],
  },
  {
    id: "create",
    label: "Create",
    hint: "Ideas, studio, and designs",
    labelKey: "nav.create",
    hintKey: "nav.create.hint",
    tabs: [
      { id: "idea-generator", label: "Idea Generator", copyKey: "tab.idea-generator" },
      { id: "idea-studio", label: "Idea Studio", copyKey: "tab.idea-studio" },
      { id: "design-studio", label: "Design Studio", copyKey: "tab.design-studio" },
    ],
  },
  {
    id: "library",
    label: "Library",
    hint: "Idea Base, Brand Books, and saved designs",
    labelKey: "nav.library",
    hintKey: "nav.library.hint",
    tabs: [
      { id: "idea-base", label: "Idea Base", copyKey: "tab.idea-base" },
      { id: "brands", label: "Brand Books", copyKey: "tab.brands" },
      { id: "repository", label: "Design Repository", copyKey: "tab.repository" },
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

/** Plan, Create, and Library in the saved order. Unknown ids are dropped. Missing defaults are appended. */
export function orderedSectionIds(order?: SectionId[] | null): SectionId[] {
  const defaults = SECTIONS.map((section) => section.id);
  const allowed = new Set(defaults);
  const seen = new Set<SectionId>();
  const out: SectionId[] = [];
  for (const id of order ?? []) {
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  for (const id of defaults) {
    if (!seen.has(id)) out.push(id);
  }
  return out;
}

export function orderedSections(order?: SectionId[] | null): NavSection[] {
  const byId = new Map(SECTIONS.map((section) => [section.id, section]));
  return orderedSectionIds(order).map((id) => byId.get(id)!);
}

/** Swap a main section one step. Subtabs never travel with a different section. */
export function moveSection(ids: SectionId[], id: SectionId, dir: -1 | 1): SectionId[] {
  const index = ids.indexOf(id);
  const next = index + dir;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  const copy = ids.slice();
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
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
