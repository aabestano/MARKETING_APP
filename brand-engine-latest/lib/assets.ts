import type { AssetPurpose, BrandAsset } from "./types";

export const ASSET_PURPOSES: { id: AssetPurpose; label: string }[] = [
  { id: "email", label: "Email Design" },
  { id: "poster", label: "Poster Illustration" },
];

export type AssetFolder = AssetPurpose | "all";

export const ASSET_FOLDERS: { id: AssetFolder; label: string }[] = [
  { id: "email", label: "Email Design" },
  { id: "poster", label: "Poster Illustration" },
  { id: "all", label: "All Assets" },
];

const VALID = new Set<AssetPurpose>(["email", "poster"]);

/** Returns a non-empty, de-duplicated, ordered purpose list. Untagged legacy assets are Email Design. */
export function normalizePurposes(value: unknown): AssetPurpose[] {
  const list = Array.isArray(value) ? value.filter((p): p is AssetPurpose => VALID.has(p as AssetPurpose)) : [];
  const out = ASSET_PURPOSES.map((p) => p.id).filter((id) => list.includes(id));
  return out.length ? out : ["email"];
}

export function assetPurposes(asset: Pick<BrandAsset, "purposes">): AssetPurpose[] {
  return normalizePurposes(asset.purposes);
}

export function assetInFolder(asset: Pick<BrandAsset, "purposes">, folder: AssetFolder): boolean {
  return folder === "all" || assetPurposes(asset).includes(folder);
}

/** Toggles one purpose, refusing to leave the asset with none. */
export function togglePurpose(current: AssetPurpose[], purpose: AssetPurpose): AssetPurpose[] {
  const set = new Set(normalizePurposes(current));
  if (set.has(purpose)) {
    if (set.size === 1) return normalizePurposes([...set]);
    set.delete(purpose);
  } else {
    set.add(purpose);
  }
  return normalizePurposes([...set]);
}
