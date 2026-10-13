import { exportPixelRatio, mmToPx, pxToMm, trimPx } from "./poster-sizes";
import type { PosterSize } from "./poster-types";

export interface ExportInfo {
  width: number;
  height: number;
  effectiveDpi: number;
  clamped: boolean;
}

const MARK_MARGIN_MM = 8;
const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

async function toCanvas(node: HTMLElement, pixelRatio: number, fontCss: string): Promise<HTMLCanvasElement> {
  const { toCanvas } = await import("html-to-image");
  if (document.fonts?.ready) await document.fonts.ready;
  return toCanvas(node, { pixelRatio, fontEmbedCSS: fontCss, cacheBust: false, backgroundColor: undefined, imagePlaceholder: BLANK_PIXEL });
}

function crop(source: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(w));
  out.height = Math.max(1, Math.round(h));
  out.getContext("2d")?.drawImage(source, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, out.width, out.height);
  return out;
}

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser could not encode the image. Try a lower DPI."))), type, quality));

export function describeExport(size: PosterSize, dpi: number, includeBleed: boolean): ExportInfo {
  const { w, h } = trimPx(size);
  const b = includeBleed ? mmToPx(size.bleedMm) : 0;
  const totalW = w + 2 * b;
  const totalH = h + 2 * b;
  const { ratio, effectiveDpi, clamped } = exportPixelRatio(totalW, totalH, dpi);
  return { width: Math.round(totalW * ratio), height: Math.round(totalH * ratio), effectiveDpi, clamped };
}

/** The node always includes the bleed area; this returns the crop for the requested export. */
function cropFor(size: PosterSize, includeBleed: boolean) {
  const { w, h } = trimPx(size);
  const bleed = mmToPx(size.bleedMm);
  const keep = includeBleed ? 0 : bleed;
  return { trimW: w, trimH: h, bleed, offset: keep, outW: w + 2 * (bleed - keep), outH: h + 2 * (bleed - keep) };
}

export async function exportPng(node: HTMLElement, size: PosterSize, opts: { dpi: number; includeBleed: boolean; fontCss: string }): Promise<{ blob: Blob; info: ExportInfo }> {
  const c = cropFor(size, opts.includeBleed);
  const info = describeExport(size, opts.dpi, opts.includeBleed);
  const ratio = info.effectiveDpi / 96;
  const full = await toCanvas(node, ratio, opts.fontCss);
  const out = crop(full, c.offset * ratio, c.offset * ratio, c.outW * ratio, c.outH * ratio);
  return { blob: await canvasToBlob(out, "image/png"), info };
}

export async function exportPdf(
  node: HTMLElement,
  size: PosterSize,
  opts: { dpi: number; includeBleed: boolean; cropMarks: boolean; fontCss: string },
): Promise<{ blob: Blob; info: ExportInfo }> {
  const c = cropFor(size, opts.includeBleed);
  const info = describeExport(size, opts.dpi, opts.includeBleed);
  const ratio = info.effectiveDpi / 96;
  const full = await toCanvas(node, ratio, opts.fontCss);
  const out = crop(full, c.offset * ratio, c.offset * ratio, c.outW * ratio, c.outH * ratio);
  const jpeg = out.toDataURL("image/jpeg", 0.93);

  const { jsPDF } = await import("jspdf");
  const artW = pxToMm(c.outW);
  const artH = pxToMm(c.outH);
  const m = opts.cropMarks ? MARK_MARGIN_MM : 0;
  const pageW = artW + 2 * m;
  const pageH = artH + 2 * m;
  const pdf = new jsPDF({ unit: "mm", format: [pageW, pageH], orientation: pageW > pageH ? "landscape" : "portrait", compress: true });
  pdf.addImage(jpeg, "JPEG", m, m, artW, artH);
  if (opts.cropMarks) {
    const bleedMm = opts.includeBleed ? size.bleedMm : 0;
    const left = m + bleedMm;
    const right = m + artW - bleedMm;
    const top = m + bleedMm;
    const bottom = m + artH - bleedMm;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.1);
    for (const x of [left, right]) {
      pdf.line(x, 1, x, m - 1);
      pdf.line(x, pageH - m + 1, x, pageH - 1);
    }
    for (const y of [top, bottom]) {
      pdf.line(1, y, m - 1, y);
      pdf.line(pageW - m + 1, y, pageW - 1, y);
    }
  }
  pdf.setProperties({ title: "Poster" });
  return { blob: pdf.output("blob"), info };
}

/** Opens a print window sized to the poster so "Save as PDF" produces a vector PDF with live text and embedded fonts. */
export function openVectorPrint(
  node: HTMLElement,
  size: PosterSize,
  opts: { includeBleed: boolean; cropMarks: boolean; fontCss: string; title: string },
): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;
  const c = cropFor(size, opts.includeBleed);
  const m = opts.cropMarks ? mmToPx(MARK_MARGIN_MM) : 0;
  const pageW = c.outW + 2 * m;
  const pageH = c.outH + 2 * m;
  const bleed = opts.includeBleed ? mmToPx(size.bleedMm) : 0;
  const marks: string[] = [];
  if (opts.cropMarks) {
    const left = m + bleed;
    const right = m + c.outW - bleed;
    const top = m + bleed;
    const bottom = m + c.outH - bleed;
    const g = mmToPx(1);
    for (const x of [left, right]) {
      marks.push(`<i style="left:${x}px;top:${g}px;width:1px;height:${m - 2 * g}px"></i>`);
      marks.push(`<i style="left:${x}px;top:${pageH - m + g}px;width:1px;height:${m - 2 * g}px"></i>`);
    }
    for (const y of [top, bottom]) {
      marks.push(`<i style="top:${y}px;left:${g}px;height:1px;width:${m - 2 * g}px"></i>`);
      marks.push(`<i style="top:${y}px;left:${pageW - m + g}px;height:1px;width:${m - 2 * g}px"></i>`);
    }
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${opts.title.replace(/[<>&]/g, "")}</title><style>
@page{size:${pxToMm(pageW).toFixed(2)}mm ${pxToMm(pageH).toFixed(2)}mm;margin:0}
html,body{margin:0;padding:0;background:#fff;width:${pageW}px;height:${pageH}px;overflow:hidden}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
.page{position:relative;width:${pageW}px;height:${pageH}px;overflow:hidden}
.clip{position:absolute;left:${m}px;top:${m}px;width:${c.outW}px;height:${c.outH}px;overflow:hidden}
.inner{position:absolute;left:${-c.offset}px;top:${-c.offset}px}
.page>i{position:absolute;background:#000;display:block}
${opts.fontCss}
</style></head><body><div class="page"><div class="clip"><div class="inner">${node.outerHTML}</div></div>${marks.join("")}</div>
<script>(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.focus();window.print()},250)})<\/script></body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}

export async function makeThumbnail(node: HTMLElement, fontCss: string, targetWidth = 360): Promise<string | undefined> {
  try {
    const ratio = Math.min(1, targetWidth / node.offsetWidth);
    const canvas = await toCanvas(node, ratio, fontCss);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function qrDataUrl(url: string): Promise<string | undefined> {
  try {
    const QR = await import("qrcode");
    return await QR.toDataURL(url, { margin: 1, width: 512, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  } catch {
    return undefined;
  }
}
