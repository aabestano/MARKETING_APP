import { isSectionKey, sectionIndex } from "./poster-blocks";
import type { PosterSpec } from "./poster-types";

const SECTION_KIND = {
  steps: "Steps and flowchart",
  bullets: "Key points",
  callout: "Callout",
  stats: "Stats",
  tips: "Tip grid",
} as const;

const BLOCK_LAYER: Record<string, string> = {
  banner: "Banner",
  brand: "Brand row",
  headline: "Headline",
  subheading: "Subheading",
  illustration: "Hero illustration",
  cta: "Call to action",
  button: "Button",
  qr: "QR code",
  footer: "Footer",
};

/** Human layer name for a poster block. SVG ids are derived from this, without spaces. */
export function posterLayerName(spec: PosterSpec, key: string): string {
  const known = BLOCK_LAYER[key];
  if (known) return known;
  if (!isSectionKey(key)) return "Section";
  const section = spec.sections[sectionIndex(key)];
  if (!section) return "Section";
  const kind = SECTION_KIND[section.type] ?? "Section";
  const title = section.title?.trim();
  return title ? `${kind}: ${title}` : kind;
}

/** XML id Figma can use as a layer name. Spaces are not legal in an id. */
export function layerId(title: string, used: Set<string>): string {
  let base = title.trim().replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/g, "");
  if (!base || !/^[A-Za-z_]/.test(base)) base = `Layer${base ? `-${base}` : ""}`;
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

export function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function painted(value: string): { color: string; opacity?: number } | null {
  const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!match) {
    if (!value || value === "transparent") return null;
    return { color: value };
  }
  const alpha = match[4] === undefined ? 1 : Number(match[4]);
  if (alpha <= 0.01) return null;
  const hex = [match[1], match[2], match[3]].map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, "0")).join("");
  return { color: `#${hex}`, opacity: alpha < 0.999 ? Math.round(alpha * 1000) / 1000 : undefined };
}

/**
 * Layered SVG of the poster on screen. Each poster block is its own group.
 * Text is real text, one object per wrapped line. Images stay separate.
 * The preview is CSS-scaled, so positions are converted back to poster pixels.
 * SVG cannot reflow text, embed missing fonts, or carry bleed and crop marks.
 */
export function posterToSvg(root: HTMLElement): string {
  const rootRect = root.getBoundingClientRect();
  const layoutW = root.offsetWidth || rootRect.width || 1;
  const layoutH = root.offsetHeight || rootRect.height || 1;
  const scale = rootRect.width / layoutW || 1;
  const xOf = (rect: DOMRect) => (rect.left - rootRect.left) / scale;
  const yOf = (rect: DOMRect) => (rect.top - rootRect.top) / scale;
  const wOf = (rect: DOMRect) => rect.width / scale;
  const hOf = (rect: DOMRect) => rect.height / scale;
  const used = new Set<string>(["poster-clip", "canvas"]);
  const parts: string[] = [];

  const canvas = painted(getComputedStyle(root).backgroundColor);
  if (canvas) {
    parts.push(`<rect id="canvas" width="${fmt(layoutW)}" height="${fmt(layoutH)}" fill="${canvas.color}"><title>Canvas</title></rect>`);
  }

  const shown = (el: Element) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
  };

  const background = (el: HTMLElement): string => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const width = wOf(box);
    const height = hOf(box);
    if (width < 0.5 || height < 0.5) return "";
    const x = xOf(box);
    const y = yOf(box);
    const radius = parseFloat(style.borderTopLeftRadius) || 0;
    const rx = radius > 0 ? ` rx="${fmt(Math.min(radius, width / 2, height / 2))}"` : "";
    const chunks: string[] = [];
    const fill = painted(style.backgroundColor);
    if (fill) {
      const opacity = fill.opacity !== undefined ? ` fill-opacity="${fill.opacity}"` : "";
      chunks.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="${fmt(height)}" fill="${fill.color}"${opacity}${rx}/>`);
    }
    const left = parseFloat(style.borderLeftWidth) || 0;
    const top = parseFloat(style.borderTopWidth) || 0;
    const right = parseFloat(style.borderRightWidth) || 0;
    const bottom = parseFloat(style.borderBottomWidth) || 0;
    const leftOnly = left > 0.5 && top < 0.5 && right < 0.5 && bottom < 0.5 && style.borderLeftStyle !== "none";
    if (leftOnly) {
      const color = painted(style.borderLeftColor);
      if (color) chunks.push(`<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(left)}" height="${fmt(height)}" fill="${color.color}"/>`);
    }
    return chunks.join("");
  };

  const textLines = (node: Text, parent: HTMLElement): string[] => {
    const value = node.data;
    if (!value.trim()) return [];
    const style = getComputedStyle(parent);
    const fill = painted(style.color);
    if (!fill) return [];
    const range = node.ownerDocument.createRange();
    type Glyph = { ch: string; x: number; top: number };
    const glyphs: Glyph[] = [];
    const limit = Math.min(value.length, 4000);
    for (let i = 0; i < limit; ) {
      const ch = String.fromCodePoint(value.codePointAt(i) ?? 0);
      const next = i + ch.length;
      if (ch === "\n" || ch === "\r") {
        glyphs.push({ ch: "\n", x: 0, top: Number.NaN });
        i = next;
        continue;
      }
      range.setStart(node, i);
      range.setEnd(node, next);
      const rect = range.getClientRects()[0];
      i = next;
      if (!rect || (rect.width === 0 && !ch.trim())) continue;
      glyphs.push({ ch, x: xOf(rect), top: yOf(rect) });
    }
    const lines: { text: string; x: number; top: number }[] = [];
    let buf: Glyph[] = [];
    const flush = () => {
      const start = buf.findIndex((glyph) => glyph.ch.trim());
      let end = -1;
      for (let i = buf.length - 1; i >= 0; i--) {
        if (buf[i].ch.trim()) {
          end = i;
          break;
        }
      }
      if (start >= 0 && end >= start) {
        const slice = buf.slice(start, end + 1);
        lines.push({ text: slice.map((glyph) => glyph.ch).join(""), x: slice[0].x, top: slice[0].top });
      }
      buf = [];
    };
    for (const glyph of glyphs) {
      if (glyph.ch === "\n" || (buf.length && Math.abs(glyph.top - buf[0].top) > 2)) {
        if (glyph.ch !== "\n" && buf.length && Math.abs(glyph.top - buf[0].top) > 2) {
          flush();
          buf.push(glyph);
          continue;
        }
        flush();
        continue;
      }
      buf.push(glyph);
    }
    flush();
    const fontSize = parseFloat(style.fontSize) || 16;
    const family = escapeXml(style.fontFamily || "sans-serif");
    const weight = style.fontWeight && style.fontWeight !== "400" ? ` font-weight="${escapeXml(style.fontWeight)}"` : "";
    const styleAttr = style.fontStyle === "italic" ? ` font-style="italic"` : "";
    const spacing = style.letterSpacing && style.letterSpacing !== "normal" && style.letterSpacing !== "0px" ? ` letter-spacing="${escapeXml(style.letterSpacing)}"` : "";
    const opacity = fill.opacity !== undefined ? ` fill-opacity="${fill.opacity}"` : "";
    return lines.map((line) => {
      const y = line.top + fontSize * 0.8;
      return `<text x="${fmt(line.x)}" y="${fmt(y)}" font-size="${fmt(fontSize)}" font-family="${family}"${weight}${styleAttr}${spacing} fill="${fill.color}"${opacity} xml:space="preserve">${escapeXml(line.text)}</text>`;
    });
  };

  const imageTag = (img: HTMLImageElement): string => {
    const box = img.getBoundingClientRect();
    const width = wOf(box);
    const height = hOf(box);
    if (width < 0.5 || height < 0.5 || !img.src) return "";
    let href = img.src;
    if (!href.startsWith("data:")) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || Math.round(width);
        canvas.height = img.naturalHeight || Math.round(height);
        const ctx = canvas.getContext("2d");
        if (ctx && canvas.width && canvas.height) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          href = canvas.toDataURL("image/png");
        }
      } catch {
        href = img.src;
      }
    }
    const fit = getComputedStyle(img).objectFit;
    const aspect = fit === "cover" ? "xMidYMid slice" : fit === "fill" ? "none" : "xMidYMid meet";
    const safe = escapeXml(href);
    return `<image href="${safe}" xlink:href="${safe}" x="${fmt(xOf(box))}" y="${fmt(yOf(box))}" width="${fmt(width)}" height="${fmt(height)}" preserveAspectRatio="${aspect}"/>`;
  };

  const svgTag = (svg: SVGSVGElement): string => {
    const box = svg.getBoundingClientRect();
    const width = wOf(box);
    const height = hOf(box);
    if (width < 0.5 || height < 0.5) return "";
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("width", fmt(width));
    clone.setAttribute("height", fmt(height));
    clone.removeAttribute("x");
    clone.removeAttribute("y");
    const color = painted(getComputedStyle(svg).color);
    if (color) {
      clone.querySelectorAll("*").forEach((node) => {
        for (const attr of ["stroke", "fill"] as const) {
          if (node.getAttribute(attr) === "currentColor") node.setAttribute(attr, color.color);
        }
      });
    }
    const xml = new XMLSerializer().serializeToString(clone);
    return `<g transform="translate(${fmt(xOf(box))} ${fmt(yOf(box))})">${xml}</g>`;
  };

  const emitBlock = (el: HTMLElement): string => {
    if (!shown(el)) return "";
    const title = el.getAttribute("data-layer") || BLOCK_LAYER[el.getAttribute("data-poster-block") || ""] || "Layer";
    const inner = emitContents(el);
    if (!inner) return "";
    const id = layerId(title, used);
    return `<g id="${escapeXml(id)}"><title>${escapeXml(title)}</title>${inner}</g>`;
  };

  const emitContents = (el: HTMLElement): string => {
    const chunks: string[] = [background(el)];
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        chunks.push(...textLines(child as Text, el));
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const node = child as HTMLElement;
      if (!shown(node)) continue;
      if (node.hasAttribute("data-poster-block")) {
        chunks.push(emitBlock(node));
        continue;
      }
      if (node.localName === "img") {
        chunks.push(imageTag(node as HTMLImageElement));
        continue;
      }
      if (node.localName === "svg") {
        chunks.push(svgTag(node as unknown as SVGSVGElement));
        continue;
      }
      chunks.push(emitContents(node));
    }
    return chunks.join("");
  };

  for (const block of root.querySelectorAll<HTMLElement>("[data-poster-block]")) {
    if (block.parentElement?.closest("[data-poster-block]")) continue;
    parts.push(emitBlock(block));
  }

  const body = parts.filter(Boolean).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(layoutW)}" height="${fmt(layoutH)}" viewBox="0 0 ${fmt(layoutW)} ${fmt(layoutH)}">\n<defs><clipPath id="poster-clip"><rect width="${fmt(layoutW)}" height="${fmt(layoutH)}"/></clipPath></defs>\n<g clip-path="url(#poster-clip)">${body}</g>\n</svg>`;
}
