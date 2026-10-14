import type { BrandAsset, BrandTokens } from "./types";

export const MIN_USABLE_ASSETS = 3;
const MIN_CHROMATIC_PIXELS = 20;
const HUE_GAP = 18;

export type SkipReason = "illustration" | "low-color" | "unreadable" | "not-color";

export interface ColorShare {
  hex: string;
  count: number;
  hue: number;
  order: number;
}

export interface AssetColorSample {
  assetId: string;
  name: string;
  status: "used" | "skipped";
  reason?: SkipReason;
  lead?: string;
  colors: ColorShare[];
  ink?: string;
  paper: ColorShare[];
  neutral: ColorShare[];
}

export interface PaletteProposal {
  ready: boolean;
  usableCount: number;
  tokens: BrandTokens;
  samples: AssetColorSample[];
  summary: string;
}

export function isIllustrationAsset(asset: Pick<BrandAsset, "name" | "role" | "directive">): boolean {
  const text = `${asset.name} ${asset.role ?? ""} ${asset.directive ?? ""}`;
  if (/\billustrat/i.test(text)) return true;
  if (asset.role === "Hero Banner" || asset.role === "Product Image") return true;
  return /\b(?:hero banner|product image|photograph|photo)\b/i.test(text);
}

export function skippedSample(assetId: string, name: string, reason: SkipReason): AssetColorSample {
  return { assetId, name, status: "skipped", reason, colors: [], paper: [], neutral: [] };
}

export function hueName(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  if (h < 15 || h >= 345) return "Red";
  if (h < 45) return "Orange";
  if (h < 70) return "Yellow";
  if (h < 165) return "Green";
  if (h < 195) return "Teal";
  if (h < 255) return "Blue";
  if (h < 290) return "Purple";
  return "Pink";
}

export function evidenceLine(sample: AssetColorSample): string {
  if (sample.status === "skipped") {
    if (sample.reason === "illustration") return `${sample.name}: skipped, illustration.`;
    if (sample.reason === "low-color") return `${sample.name}: skipped, too little color.`;
    if (sample.reason === "unreadable") return `${sample.name}: skipped, the file could not be read.`;
    return `${sample.name}: skipped, not used for colors.`;
  }
  const lead = sample.colors[0];
  if (!lead) return `${sample.name}: skipped, too little color.`;
  return `${sample.name}: ${hueName(lead.hue)} ${lead.hex} leads.`;
}

export function extractHexCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (hex: string, times = 1) => counts.set(hex, (counts.get(hex) ?? 0) + times);
  for (const match of text.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
    add(normalizeHex(match[0]));
  }
  for (const match of text.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi)) {
    const channels = [match[1], match[2], match[3]].map((n) => Math.min(255, Number(n)));
    add(toHex(channels[0], channels[1], channels[2]));
  }
  return counts;
}

export function sampleFromPixels(assetId: string, name: string, pixels: Uint8ClampedArray): AssetColorSample {
  return sampleFromTally(assetId, name, tallyPixels(pixels));
}

export function sampleFromHexCounts(assetId: string, name: string, counts: Map<string, number>): AssetColorSample {
  const paints = [...counts.entries()].map(([hex, count]) => ({ hex, times: Math.max(24, count * 8) }));
  const pixels = new Uint8ClampedArray(paints.reduce((total, paint) => total + paint.times, 0) * 4);
  let offset = 0;
  for (const paint of paints) {
    const [r, g, b] = rgb(paint.hex);
    for (let i = 0; i < paint.times; i++) {
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = 255;
      offset += 4;
    }
  }
  return sampleFromPixels(assetId, name, pixels);
}

export function votePalette(samples: AssetColorSample[]): PaletteProposal {
  const usable = samples.filter((sample) => sample.status === "used" && sample.colors.length > 0);
  if (usable.length < MIN_USABLE_ASSETS) {
    return {
      ready: false,
      usableCount: usable.length,
      tokens: {},
      samples,
      summary: "At least 3 logos, templates, or guides need readable brand colors before a palette can be suggested.",
    };
  }

  const primaryGroup = winningHue(usable.map((sample) => ({ color: sample.colors[0], assets: 1 })));
  const primaryHue = primaryGroup?.hue ?? usable[0].colors[0].hue;
  const primary = averageHex(
    usable
      .filter((sample) => hueDistance(sample.colors[0].hue, primaryHue) <= HUE_GAP)
      .map((sample) => ({ hex: sample.colors[0].hex, weight: sample.colors[0].count })),
  );

  const accentVotes = new Map<number, { hex: string; weight: number }[]>();
  for (const sample of usable) {
    const lead = sample.colors[0];
    const seen = new Set<number>();
    for (const color of sample.colors) {
      if (hueDistance(color.hue, primaryHue) <= HUE_GAP) continue;
      if (color.count < Math.max(12, lead.count * 0.18)) continue;
      const bucket = hueBucket(color.hue);
      if (seen.has(bucket)) continue;
      seen.add(bucket);
      const list = accentVotes.get(bucket) ?? [];
      list.push({ hex: color.hex, weight: color.count });
      accentVotes.set(bucket, list);
    }
  }
  const accentEntry = [...accentVotes.entries()].sort((a, b) => b[1].length - a[1].length || sumWeight(b[1]) - sumWeight(a[1]))[0];

  const tokens: BrandTokens = { primary };
  if (accentEntry && accentEntry[1].length >= 2) tokens.accent = averageHex(accentEntry[1]);

  const ink = majorityColor(usable.map((sample) => sample.ink).filter((hex): hex is string => !!hex), usable.length);
  if (ink) tokens.textColor = ink;

  const paper = rankedHexes(usable.flatMap((sample) => sample.paper.map((color) => ({ ...color, assetId: sample.assetId }))));
  if (paper[0]) tokens.canvasBg = paper[0];
  if (paper[1] && channelDistance(paper[0], paper[1]) > 12) tokens.containerBg = paper[1];

  const neutrals = usable.flatMap((sample) => sample.neutral.map((color) => ({ ...color, assetId: sample.assetId })));
  const border = rankedHexes(neutrals.filter((color) => lightness(color.hex) >= 0.75));
  const muted = rankedHexes(neutrals.filter((color) => lightness(color.hex) < 0.75));
  if (border[0]) tokens.borderColor = border[0];
  if (muted[0]) tokens.mutedColor = muted[0];

  return {
    ready: true,
    usableCount: usable.length,
    tokens,
    samples,
    summary: `Suggested from ${usable.length} assets. Nothing is saved until you apply it.`,
  };
}

interface Tally {
  chromatic: ColorShare[];
  ink: ColorShare[];
  paper: ColorShare[];
  neutral: ColorShare[];
}

function sampleFromTally(assetId: string, name: string, tally: Tally): AssetColorSample {
  const colors = mergeHues(tally.chromatic);
  if (!colors[0] || colors[0].count < MIN_CHROMATIC_PIXELS) return skippedSample(assetId, name, "low-color");
  return {
    assetId,
    name,
    status: "used",
    lead: colors[0].hex,
    colors: colors.slice(0, 6),
    ink: tally.ink[0] && tally.ink[0].count >= 12 ? tally.ink[0].hex : undefined,
    paper: tally.paper.filter((color) => color.count >= 12).slice(0, 4),
    neutral: mergeNeutrals(tally.neutral).slice(0, 4),
  };
}

function tallyPixels(pixels: Uint8ClampedArray): Tally {
  const buckets = new Map<string, { kind: keyof Tally; sumR: number; sumG: number; sumB: number; count: number; order: number; mode: Map<string, number> }>();
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 16) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const kind = classify(r, g, b);
    const key = `${kind}:${Math.round(r / 8) * 8},${Math.round(g / 8) * 8},${Math.round(b / 8) * 8}`;
    const bucket = buckets.get(key) ?? { kind, sumR: 0, sumG: 0, sumB: 0, count: 0, order: i, mode: new Map<string, number>() };
    const exact = toHex(r, g, b);
    bucket.mode.set(exact, (bucket.mode.get(exact) ?? 0) + 1);
    bucket.sumR += r;
    bucket.sumG += g;
    bucket.sumB += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  const tally: Tally = { chromatic: [], ink: [], paper: [], neutral: [] };
  for (const bucket of buckets.values()) {
    let modeHex = "";
    let modeCount = 0;
    for (const [hex, count] of bucket.mode) {
      if (count > modeCount) {
        modeHex = hex;
        modeCount = count;
      }
    }
    const averaged = toHex(bucket.sumR / bucket.count, bucket.sumG / bucket.count, bucket.sumB / bucket.count);
    const hex = modeCount >= bucket.count * 0.8 ? modeHex : averaged;
    tally[bucket.kind].push({ hex, count: bucket.count, hue: hsl(rgb(hex)).h, order: bucket.order });
  }
  for (const kind of Object.keys(tally) as (keyof Tally)[]) tally[kind].sort(byCount);
  return tally;
}

function classify(r: number, g: number, b: number): keyof Tally {
  const { s, l } = hsl([r, g, b]);
  if (l >= 0.93) return "paper";
  if (l <= 0.16) return "ink";
  if (s >= 0.28 && l > 0.18 && l < 0.85) return "chromatic";
  return "neutral";
}

function byCount(a: ColorShare, b: ColorShare): number {
  return b.count - a.count || a.order - b.order;
}

function mergeHues(colors: ColorShare[]): ColorShare[] {
  const sorted = [...colors].sort((a, b) => a.hue - b.hue);
  const groups: ColorShare[][] = [];
  for (const color of sorted) {
    const group = groups.find((items) => hueDistance(items[0].hue, color.hue) <= 12);
    if (group) group.push(color);
    else groups.push([color]);
  }
  return groups
    .map((group) => ({
      hex: averageHex(group.map((color) => ({ hex: color.hex, weight: color.count }))),
      count: group.reduce((total, color) => total + color.count, 0),
      hue: group[0].hue,
      order: Math.min(...group.map((color) => color.order)),
    }))
    .sort(byCount);
}

function mergeNeutrals(colors: ColorShare[]): ColorShare[] {
  return mergeHues(colors.map((color) => ({ ...color, hue: lightness(color.hex) * 360 })));
}

function winningHue(votes: { color: ColorShare; assets: number }[]): { hue: number } | undefined {
  const groups = new Map<number, { hue: number; assets: number; weight: number }>();
  for (const vote of votes) {
    const bucket = hueBucket(vote.color.hue);
    const group = groups.get(bucket) ?? { hue: vote.color.hue, assets: 0, weight: 0 };
    group.assets += vote.assets;
    group.weight += vote.color.count;
    groups.set(bucket, group);
  }
  return [...groups.values()].sort((a, b) => b.assets - a.assets || b.weight - a.weight)[0];
}

function majorityColor(hexes: string[], usable: number): string | undefined {
  if (hexes.length < Math.max(2, Math.ceil(usable / 2))) return undefined;
  return averageHex(hexes.map((hex) => ({ hex, weight: 1 })));
}

function rankedHexes(colors: (ColorShare & { assetId: string })[]): string[] {
  const groups = new Map<string, { items: { hex: string; weight: number }[]; assets: Set<string> }>();
  for (const color of colors) {
    const channels = rgb(color.hex);
    const key = `${Math.round(channels[0] / 12)},${Math.round(channels[1] / 12)},${Math.round(channels[2] / 12)}`;
    const group = groups.get(key) ?? { items: [], assets: new Set<string>() };
    group.items.push({ hex: color.hex, weight: color.count });
    group.assets.add(color.assetId);
    groups.set(key, group);
  }
  return [...groups.values()]
    .filter((group) => group.assets.size >= 2)
    .sort((a, b) => sumWeight(b.items) - sumWeight(a.items))
    .map((group) => averageHex(group.items));
}

function hueBucket(hue: number): number {
  return Math.round(hue / 15);
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function averageHex(items: { hex: string; weight: number }[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let weight = 0;
  for (const item of items) {
    const channels = rgb(item.hex);
    r += channels[0] * item.weight;
    g += channels[1] * item.weight;
    b += channels[2] * item.weight;
    weight += item.weight;
  }
  return toHex(r / weight, g / weight, b / weight);
}

function channelDistance(a: string, b: string): number {
  const left = rgb(a);
  const right = rgb(b);
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]), Math.abs(left[2] - right[2]));
}

function lightness(hex: string): number {
  return hsl(rgb(hex)).l;
}

function sumWeight(items: { weight: number }[]): number {
  return items.reduce((total, item) => total + item.weight, 0);
}

function normalizeHex(value: string): string {
  const raw = value.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
  return `#${full.toUpperCase()}`;
}

function rgb(hex: string): [number, number, number] {
  const full = normalizeHex(hex).slice(1);
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  const channel = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function hsl([r, g, b]: [number, number, number]): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = (max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4) * 60;
  return { h: h < 0 ? h + 360 : h, s, l };
}
