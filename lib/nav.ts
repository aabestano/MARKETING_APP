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
