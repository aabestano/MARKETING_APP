export function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function readAsText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file."));
    reader.readAsText(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image."));
    el.src = src;
  });
}

export interface DownscaleOptions {
  maxEdge?: number;
  quality?: number;
  /** keep PNG transparency (used for poster illustrations); falls back to JPEG if the result is very large */
  keepAlpha?: boolean;
}

/** Downscales an image data URL so it fits comfortably in browser storage and request limits. */
export async function downscaleDataUrl(dataUrl: string, { maxEdge = 1100, quality = 0.72, keepAlpha = false }: DownscaleOptions = {}): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  if (keepAlpha && /^data:image\/png/.test(dataUrl)) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL("image/png");
    if (png.length * 0.75 <= 3 * 1024 * 1024) return png;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Downscales screenshots so they fit comfortably in browser storage and the Gemini request. */
export async function downscaleImage(file: File, options: DownscaleOptions = {}): Promise<string> {
  return downscaleDataUrl(await readAsDataUrl(file), options);
}

const MAX_ATTACHED_VISUALS = 3;
const MAX_ATTACHED_BYTES = 3.2 * 1024 * 1024;

/**
 * Prepares brand assets for an email-generation request. Vercel rejects request bodies over 4.5 MB, so only the
 * first few visual files keep their pixels (the server attaches at most three to Gemini anyway), images are
 * shrunk to email size, and fonts and SVG data never leave the browser.
 */
export async function slimAssetsForRequest<T extends { kind: string; dataUrl?: string; mime?: string }>(assets: T[]): Promise<T[]> {
  const out: T[] = [];
  let used = 0;
  let attached = 0;
  for (const asset of assets) {
    if (asset.kind === "font") continue;
    const visual = asset.kind === "image" || asset.kind === "pdf";
    if (!visual || !asset.dataUrl) {
      out.push(asset.kind === "template" || asset.kind === "cdn-url" ? asset : { ...asset, dataUrl: undefined });
      continue;
    }
    let dataUrl: string | undefined = asset.dataUrl;
    const isSvg = /^data:image\/svg/.test(dataUrl);
    if (isSvg || attached >= MAX_ATTACHED_VISUALS) dataUrl = undefined;
    else if (asset.kind === "image" && dataUrl.length * 0.75 > 350 * 1024) {
      try {
        dataUrl = await downscaleDataUrl(dataUrl, { maxEdge: 1100, quality: 0.72 });
      } catch {
        dataUrl = undefined;
      }
    }
    if (dataUrl) {
      const bytes = dataUrl.length * 0.75;
      if (used + bytes > MAX_ATTACHED_BYTES) dataUrl = undefined;
      else {
        used += bytes;
        attached++;
      }
    }
    out.push({ ...asset, dataUrl });
  }
  return out;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openHtmlInNewTab(html: string): boolean {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return !!win;
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}
