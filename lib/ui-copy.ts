export const LABEL_LIMIT = 120;
export const HINT_LIMIT = 280;

export interface CopyEntry {
  text: string;
  limit: number;
  where: string;
}

export const UI_COPY = {
  "nav.plan": { text: "Plan", limit: LABEL_LIMIT, where: "Sidebar section" },
  "nav.plan.hint": { text: "Calendar", limit: HINT_LIMIT, where: "Sidebar section description" },
  "nav.create": { text: "Create", limit: LABEL_LIMIT, where: "Sidebar section" },
  "nav.create.hint": { text: "Ideas, studio, and designs", limit: HINT_LIMIT, where: "Sidebar section description" },
  "nav.library": { text: "Library", limit: LABEL_LIMIT, where: "Sidebar section" },
  "nav.library.hint": { text: "Idea Base, Brand Books, and saved designs", limit: HINT_LIMIT, where: "Sidebar section description" },
  "nav.moveUp": { text: "Move up", limit: LABEL_LIMIT, where: "Sidebar section control" },
  "nav.moveDown": { text: "Move down", limit: LABEL_LIMIT, where: "Sidebar section control" },
  "nav.reset": { text: "Reset tab order", limit: LABEL_LIMIT, where: "Settings" },
  "tab.calendar": { text: "Calendar", limit: LABEL_LIMIT, where: "Plan tab" },
  "tab.repository": { text: "Design Repository", limit: LABEL_LIMIT, where: "Library tab" },
  "tab.idea-generator": { text: "Idea Generator", limit: LABEL_LIMIT, where: "Create tab" },
  "tab.idea-studio": { text: "Idea Studio", limit: LABEL_LIMIT, where: "Create tab" },
  "tab.design-studio": { text: "Design Studio", limit: LABEL_LIMIT, where: "Create tab" },
  "tab.idea-base": { text: "Idea Base", limit: LABEL_LIMIT, where: "Library tab" },
  "tab.brands": { text: "Brand Books", limit: LABEL_LIMIT, where: "Library tab" },
  "settings.title": { text: "API and Mail Settings", limit: LABEL_LIMIT, where: "Settings heading" },
  "settings.appName": { text: "App name", limit: LABEL_LIMIT, where: "Settings" },
  "settings.appName.hint": {
    text: "This is the name in the sidebar, the browser tab, and calendar exports. Leave it blank to use IDEAte.",
    limit: HINT_LIMIT,
    where: "Settings helper",
  },
  "settings.save": { text: "Save settings", limit: LABEL_LIMIT, where: "Settings button" },
  "settings.cancel": { text: "Cancel", limit: LABEL_LIMIT, where: "Settings button" },
  "settings.api": { text: "API and Mail Settings", limit: LABEL_LIMIT, where: "Sidebar settings button" },
  "download.poster": { text: "Download Poster", limit: LABEL_LIMIT, where: "Poster download menu" },
  "download.svg": { text: "Figma SVG", limit: LABEL_LIMIT, where: "Poster download menu" },
  "download.svg.hint": {
    text: "Drag this file into Figma, or open it with the IDEAte plugin. Text stays editable, and fonts need to be installed there.",
    limit: HINT_LIMIT,
    where: "Poster download menu",
  },
  "repo.title": { text: "Design Repository", limit: LABEL_LIMIT, where: "Design Repository heading" },
  "repo.hint": {
    text: "Everything you saved from the Design Studio. Open a poster to keep editing, or inspect an email to tweak its HTML.",
    limit: HINT_LIMIT,
    where: "Design Repository helper",
  },
  "brand.all": { text: "All brand books", limit: LABEL_LIMIT, where: "Brand book tag" },
  "brand.availableAll": { text: "Available to all brand books", limit: LABEL_LIMIT, where: "Asset tag" },
  "brand.addDesign": { text: "Add to brand book", limit: LABEL_LIMIT, where: "Saved design" },
  "brand.emailDesign": { text: "Email design", limit: LABEL_LIMIT, where: "Brand book" },
  "brand.posterDesign": { text: "Poster design", limit: LABEL_LIMIT, where: "Brand book" },
  "brand.create": { text: "Brand book", limit: LABEL_LIMIT, where: "Create" },
  "copy.heading": { text: "Interface text", limit: LABEL_LIMIT, where: "Settings" },
  "copy.resetAll": { text: "Reset all interface text", limit: LABEL_LIMIT, where: "Settings" },
  "poster.removeBg": { text: "Remove background", limit: LABEL_LIMIT, where: "Poster illustrator" },
  "poster.removeBg.hint": {
    text: "A plain white or empty edge becomes transparency. Interior white, such as a logo, stays. The original file is unchanged.",
    limit: HINT_LIMIT,
    where: "Poster illustrator helper",
  },
} as const;

export type CopyKey = keyof typeof UI_COPY;

const CONTROL = /[\u0000-\u001F\u007F]/g;

export function cleanCopyText(value: string, limit: number): string {
  return value.replace(CONTROL, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

/** Saved wording, or the built-in sentence when the override is blank. */
export function uiCopy(key: CopyKey, overrides?: Partial<Record<CopyKey, string>> | null): string {
  const entry = UI_COPY[key];
  const raw = overrides?.[key];
  const custom = typeof raw === "string" ? cleanCopyText(raw, entry.limit) : "";
  return custom || entry.text;
}
