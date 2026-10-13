import type { PosterSection, PosterSpec } from "./poster-types";

/** Text may shrink to this fraction of its design size, and no further. */
export const MIN_FIT = 0.85;

/** Fine print (disclaimer, tagline, link, decision chips) is drawn this much larger than the old base. */
export const FINE_PRINT_SCALE = 1.1;

export const HERO_RATIO = { s: 0.24, m: 0.27, l: 0.3 } as const;
export type HeroSize = keyof typeof HERO_RATIO;

export const SLOT_ROLE = ["Brand row", "Headline", "Text", "Subtext"] as const;

export type FixedBlock = "brand" | "headline" | "subheading" | "illustration" | "cta" | "footer";
export type SectionBlock = `section:${number}`;
export type PosterBlockKey = FixedBlock | SectionBlock;
export type FlowItem = PosterBlockKey | "banner";

export interface PosterLayout {
  /** Reading order. Bannered blocks are represented once, by the "banner" marker. */
  order: FlowItem[];
  /** Up to four blocks, in slot order. Empty means there is no banner. */
  banner: PosterBlockKey[];
}

const FIXED: FixedBlock[] = ["brand", "headline", "subheading", "illustration", "cta", "footer"];
const BANNER_LIMIT = 4;

export const sectionKey = (index: number): SectionBlock => `section:${index}`;

export function isSectionKey(key: string): key is SectionBlock {
  return /^section:\d+$/.test(key);
}

export function sectionIndex(key: SectionBlock): number {
  return Number(key.slice("section:".length));
}

export function bannerEligible(key: PosterBlockKey, sections: Pick<PosterSection, "type">[]): boolean {
  if (key === "brand" || key === "headline" || key === "subheading") return true;
  if (!isSectionKey(key)) return false;
  return sections[sectionIndex(key)]?.type === "callout";
}

export function defaultLayout(sectionCount: number): PosterLayout {
  const sections = Array.from({ length: sectionCount }, (_, i) => sectionKey(i));
  return {
    order: ["banner", "illustration", ...sections, "cta", "footer"],
    banner: ["brand", "headline", "subheading"],
  };
}

function wantedKeys(sectionCount: number): PosterBlockKey[] {
  return [...FIXED, ...Array.from({ length: sectionCount }, (_, i) => sectionKey(i))];
}

/** Drops unknown keys, caps the banner at four eligible blocks, and puts every block somewhere exactly once. */
export function normalizeLayout(layout: PosterLayout | undefined, sections: Pick<PosterSection, "type">[]): PosterLayout {
  const count = sections.length;
  const base = layout ?? defaultLayout(count);
  const wanted = new Set<PosterBlockKey>(wantedKeys(count));

  const banner: PosterBlockKey[] = [];
  for (const key of base.banner ?? []) {
    if (banner.length >= BANNER_LIMIT) break;
    if (!wanted.has(key) || banner.includes(key) || !bannerEligible(key, sections)) continue;
    banner.push(key);
  }
  const inBanner = new Set(banner);
  const order: FlowItem[] = [];
  let sawBanner = false;
  for (const item of base.order ?? []) {
    if (item === "banner") {
      if (!sawBanner && banner.length > 0) {
        order.push("banner");
        sawBanner = true;
      }
      continue;
    }
    if (!wanted.has(item) || inBanner.has(item) || order.includes(item)) continue;
    order.push(item);
  }
  if (banner.length > 0 && !sawBanner) order.unshift("banner");
  for (const key of wanted) {
    if (inBanner.has(key) || order.includes(key)) continue;
    const ctaAt = order.indexOf("cta");
    if (isSectionKey(key) && ctaAt >= 0) order.splice(ctaAt, 0, key);
    else order.push(key);
  }
  return { order, banner };
}

export function layoutOf(spec: Pick<PosterSpec, "layout" | "sections">): PosterLayout {
  return normalizeLayout(spec.layout, spec.sections);
}

export function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

export function moveInOrder(layout: PosterLayout, index: number, dir: -1 | 1): PosterLayout {
  return { ...layout, order: moveItem(layout.order, index, dir) };
}

export function moveInBanner(layout: PosterLayout, index: number, dir: -1 | 1): PosterLayout {
  return { ...layout, banner: moveItem(layout.banner, index, dir) };
}

/** Toggle on appends the block as the last banner slot. Toggle off places it directly under the banner. */
export function setInBanner(layout: PosterLayout, key: PosterBlockKey, on: boolean, sections: Pick<PosterSection, "type">[]): PosterLayout {
  if (on) {
    if (!bannerEligible(key, sections) || layout.banner.includes(key) || layout.banner.length >= BANNER_LIMIT) return layout;
    const banner = [...layout.banner, key];
    const order = [...layout.order];
    const at = order.indexOf(key);
    if (order.includes("banner")) {
      if (at >= 0) order.splice(at, 1);
    } else if (at >= 0) {
      order.splice(at, 1, "banner");
    } else {
      order.unshift("banner");
    }
    return normalizeLayout({ order, banner }, sections);
  }
  if (!layout.banner.includes(key)) return layout;
  const banner = layout.banner.filter((item) => item !== key);
  const order = layout.order.filter((item) => item !== key);
  const at = order.indexOf("banner");
  if (at >= 0) order.splice(at + 1, 0, key);
  else order.unshift(key);
  if (banner.length === 0) {
    const marker = order.indexOf("banner");
    if (marker >= 0) order.splice(marker, 1);
  }
  return normalizeLayout({ order, banner }, sections);
}

export function insertSection(layout: PosterLayout, sections: Pick<PosterSection, "type">[]): PosterLayout {
  return normalizeLayout(layout, sections);
}

export function removeSection(layout: PosterLayout, removed: number, sections: Pick<PosterSection, "type">[]): PosterLayout {
  const mapKey = (key: PosterBlockKey): PosterBlockKey | null => {
    if (!isSectionKey(key)) return key;
    const index = sectionIndex(key);
    if (index === removed) return null;
    return index > removed ? sectionKey(index - 1) : key;
  };
  const order: FlowItem[] = [];
  for (const item of layout.order) {
    if (item === "banner") {
      order.push(item);
      continue;
    }
    const mapped = mapKey(item);
    if (mapped) order.push(mapped);
  }
  const banner = layout.banner.map(mapKey).filter((key): key is PosterBlockKey => !!key);
  return normalizeLayout({ order, banner }, sections);
}

export function posterUnit(trimW: number, trimH: number): number {
  return Math.sqrt(trimW * trimH) / 100;
}

/** Design size in CSS pixels, before the fit shrink and at the 0.85 floor. */
export function textSizePx(multiplier: number, trimW: number, trimH: number, fit = 1): number {
  return multiplier * posterUnit(trimW, trimH) * fit;
}
