import { assetInFolder } from "./assets";
import type { BrandAsset } from "./types";

const STOP = new Set(["with", "your", "from", "that", "this", "have", "will", "into", "about", "more", "than", "their", "them", "they", "what", "when", "where", "which", "while", "image", "illustration", "picture", "poster", "photo", "icon", "png", "jpg", "jpeg", "svg"]);

const words = (text: string): string[] =>
  Array.from(new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w))));

export const isPosterImage = (a: BrandAsset) => a.kind === "image" && !!a.dataUrl && /^data:image\/(png|jpe?g|svg\+xml|webp)/.test(a.dataUrl);

/** Poster-tagged pictures from a brand book, excluding logos. */
export function posterIllustrations(assets: BrandAsset[], bookId: string | null): BrandAsset[] {
  return assets.filter((a) => a.bookId === bookId && assetInFolder(a, "poster") && isPosterImage(a) && !isLogo(a));
}

export function isLogo(a: BrandAsset): boolean {
  return /logo/i.test(a.role ?? "") || /logo/i.test(a.name);
}

/** Logo picked by id, else the first poster-tagged logo (embedded image or CDN URL). */
export function findLogo(assets: BrandAsset[], bookId: string | null, assetId?: string): BrandAsset | undefined {
  const pool = assets.filter((a) => a.bookId === bookId && assetInFolder(a, "poster"));
  const byId = assetId ? pool.find((a) => a.id === assetId) : undefined;
  if (byId) return byId;
  return pool.find((a) => isLogo(a) && ((a.kind === "image" && a.dataUrl) || (a.kind === "cdn-url" && a.url)));
}

export function assetSrc(a: BrandAsset | undefined): string | undefined {
  if (!a) return undefined;
  return a.kind === "cdn-url" ? a.url : a.dataUrl;
}

/** Offline matcher: best illustration by word overlap with the poster text. Returns undefined when nothing relates. */
export function pickIllustration(candidates: BrandAsset[], text: string): BrandAsset | undefined {
  const target = new Set(words(text));
  let best: BrandAsset | undefined;
  let bestScore = 0;
  for (const a of candidates) {
    const score = words(`${a.name} ${a.role ?? ""} ${a.directive ?? ""}`).filter((w) => target.has(w)).length;
    if (score > bestScore || (score === bestScore && score > 0 && best && a.createdAt > best.createdAt)) {
      best = a;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : undefined;
}
