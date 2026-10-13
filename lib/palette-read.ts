import { assetFile, isRemoteImage } from "./asset-file";
import {
  extractHexCounts,
  isIllustrationAsset,
  sampleFromHexCounts,
  sampleFromPixels,
  skippedSample,
  votePalette,
  type PaletteProposal,
} from "./palette";
import type { BrandAsset } from "./types";

/** Reads brand colors from the book. pdf.js loads only when a PDF is sampled. */
export async function readPalette(assets: BrandAsset[]): Promise<PaletteProposal> {
  const samples = [];
  for (const asset of assets) samples.push(await readAsset(asset));
  return votePalette(samples);
}

async function readAsset(asset: BrandAsset) {
  if (asset.kind === "font") return skippedSample(asset.id, asset.name, "not-color");
  if (isIllustrationAsset(asset)) return skippedSample(asset.id, asset.name, "illustration");
  try {
    if (asset.kind === "template") {
      if (!asset.text?.trim()) return skippedSample(asset.id, asset.name, "unreadable");
      return sampleFromHexCounts(asset.id, asset.name, extractHexCounts(asset.text));
    }
    if (asset.kind === "pdf" && asset.dataUrl) {
      const file = assetFile(asset);
      if (!file) return skippedSample(asset.id, asset.name, "unreadable");
      const pixels = await pixelsFromPdf(file.bytes);
      return pixels ? sampleFromPixels(asset.id, asset.name, pixels) : skippedSample(asset.id, asset.name, "unreadable");
    }
    const src = asset.kind === "image" ? asset.dataUrl : isRemoteImage(asset) ? asset.url : undefined;
    if (!src) return skippedSample(asset.id, asset.name, "unreadable");
    const pixels = await pixelsFromImage(src);
    return pixels ? sampleFromPixels(asset.id, asset.name, pixels) : skippedSample(asset.id, asset.name, "unreadable");
  } catch {
    return skippedSample(asset.id, asset.name, "unreadable");
  }
}

async function pixelsFromImage(src: string): Promise<Uint8ClampedArray | null> {
  const bitmap = await loadBitmap(src);
  if (!bitmap) return null;
  const scale = Math.min(1, 120 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true, colorSpace: "srgb" });
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  try {
    return context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }
}

async function loadBitmap(src: string): Promise<ImageBitmap | null> {
  try {
    const response = await fetch(src);
    if (response.ok) return await createImageBitmap(await response.blob(), { colorSpaceConversion: "none" });
  } catch {
    // Hosted images can block a fetch. The element path below still tries a preview.
  }
  const img = new Image();
  img.crossOrigin = "anonymous";
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
  if (!loaded) return null;
  try {
    return await createImageBitmap(img, { colorSpaceConversion: "none" });
  } catch {
    return null;
  }
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | undefined;

function loadPdfjs() {
  pdfjsPromise ??= import("pdfjs-dist").then((pdfjs) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    }
    return pdfjs;
  });
  return pdfjsPromise;
}

async function pixelsFromPdf(bytes: Uint8Array): Promise<Uint8ClampedArray | null> {
  const pdfjs = await loadPdfjs();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const task = pdfjs.getDocument({ data: copy });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(1, 160 / Math.max(1, unscaled.width)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
    if (!canvasContext) return null;
    await page.render({ canvas, canvasContext, viewport }).promise;
    return canvasContext.getImageData(0, 0, canvas.width, canvas.height).data;
  } finally {
    await task.destroy();
  }
}
