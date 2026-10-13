import type { BrandAsset } from "./types";

export type AssetPreview = "pdf" | "image" | "template";

const IMAGE_URL = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i;

export function isRemoteImage(asset: Pick<BrandAsset, "kind" | "url" | "mime">): boolean {
  if (asset.kind !== "cdn-url" || !asset.url) return false;
  return IMAGE_URL.test(asset.url) || /^image\//.test(asset.mime ?? "");
}

/** How an asset can be shown. Fonts and other files are download only. */
export function assetPreviewKind(asset: Pick<BrandAsset, "kind" | "dataUrl" | "text" | "url" | "mime">): AssetPreview | null {
  if (asset.kind === "pdf" && asset.dataUrl) return "pdf";
  if (asset.kind === "image" && asset.dataUrl) return "image";
  if (isRemoteImage(asset)) return "image";
  if (asset.kind === "template" && asset.text?.trim()) return "template";
  return null;
}

export function templateMode(name: string, text: string): "mjml" | "html" | "text" {
  if (/\.mjml$/i.test(name) || /<mjml[\s>]|<mj-/i.test(text)) return "mjml";
  if (/\.html?$/i.test(name) || /<(?:html|body|table|div|p)\b/i.test(text)) return "html";
  return "text";
}

export interface AssetFile {
  filename: string;
  mime: string;
  bytes: Uint8Array;
}

export function assetFile(asset: Pick<BrandAsset, "kind" | "name" | "mime" | "dataUrl" | "text">): AssetFile | null {
  if (asset.dataUrl) {
    const parsed = parseDataUrl(asset.dataUrl);
    if (!parsed) return null;
    return { filename: filenameFor(asset), mime: asset.mime || parsed.mime, bytes: parsed.bytes };
  }
  if (asset.kind === "template" && asset.text != null) {
    return { filename: filenameFor(asset), mime: asset.mime || "text/plain", bytes: new TextEncoder().encode(asset.text) };
  }
  return null;
}

export function parseDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) return null;
  const meta = dataUrl.slice("data:".length, comma);
  const body = dataUrl.slice(comma + 1);
  const mime = meta.split(";")[0] || "application/octet-stream";
  try {
    if (/;base64/i.test(`;${meta}`)) return { mime, bytes: decodeBase64(body.replace(/\s/g, "")) };
    return { mime, bytes: new TextEncoder().encode(decodeURIComponent(body)) };
  } catch {
    return null;
  }
}

export function downloadAssetFile(file: AssetFile) {
  const blob = new Blob([toBlobPart(file.bytes)], { type: file.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function blobUrlFor(file: AssetFile): string {
  return URL.createObjectURL(new Blob([toBlobPart(file.bytes)], { type: file.mime }));
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function filenameFor(asset: Pick<BrandAsset, "kind" | "name" | "mime">): string {
  const cleaned = (asset.name || "asset").replace(/[\\/]+/g, " ").trim() || "asset";
  if (/\.[a-z0-9]{1,8}$/i.test(cleaned)) return cleaned;
  const ext =
    asset.kind === "pdf"
      ? ".pdf"
      : asset.kind === "template"
        ? asset.mime?.includes("html")
          ? ".html"
          : ".txt"
        : asset.kind === "font"
          ? ".ttf"
          : asset.mime === "image/png"
            ? ".png"
            : asset.mime === "image/jpeg"
              ? ".jpg"
              : asset.mime === "image/svg+xml"
                ? ".svg"
                : "";
  return `${cleaned}${ext}`;
}

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(value, "base64"));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
