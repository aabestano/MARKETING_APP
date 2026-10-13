import type { ResolvedTokens } from "./brand-tokens";
import type { PosterSection, PosterSpec, PosterStep, PosterTheme } from "./poster-types";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function themeFromTokens(t: ResolvedTokens): PosterTheme {
  return {
    background: t.containerBg,
    surface: t.canvasBg,
    text: t.textColor,
    muted: t.mutedColor,
    primary: t.primary,
    accent: t.accent,
    onPrimary: t.buttonTextColor,
  };
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : undefined;
};

const multiline = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return s ? s.slice(0, max) : undefined;
};

const color = (v: unknown, fallback: string): string => (typeof v === "string" && HEX.test(v.trim()) ? v.trim() : fallback);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function cleanStep(raw: unknown): PosterStep | null {
  if (typeof raw === "string") {
    const label = str(raw, 120);
    return label ? { label } : null;
  }
  if (!isObj(raw)) return null;
  const label = str(raw.label ?? raw.title, 120);
  if (!label) return null;
  const step: PosterStep = { label };
  const detail = str(raw.detail ?? raw.description, 220);
  if (detail) step.detail = detail;
  if (isObj(raw.decision)) {
    const yes = str(raw.decision.yes, 120);
    const no = str(raw.decision.no, 120);
    if (yes || no) step.decision = { yes, no };
  }
  return step;
}

function cleanSection(raw: unknown): PosterSection | null {
  if (!isObj(raw)) return null;
  const title = str(raw.title, 90);
  switch (raw.type) {
    case "steps": {
      const items = (Array.isArray(raw.items) ? raw.items : []).map(cleanStep).filter((s): s is PosterStep => !!s).slice(0, 12);
      if (!items.length) return null;
      return { type: "steps", title, style: raw.style === "numbered" ? "numbered" : "flowchart", items };
    }
    case "bullets": {
      const items = (Array.isArray(raw.items) ? raw.items : []).map((i) => str(i, 200)).filter((s): s is string => !!s).slice(0, 12);
      return items.length ? { type: "bullets", title, items } : null;
    }
    case "callout": {
      const body = multiline(raw.body, 400);
      return body ? { type: "callout", title, body } : null;
    }
    case "stats": {
      const items = (Array.isArray(raw.items) ? raw.items : [])
        .map((i) => (isObj(i) ? { value: str(i.value, 20), label: str(i.label, 60) } : null))
        .filter((i): i is { value: string; label: string } => !!i && !!i.value && !!i.label)
        .slice(0, 4);
      return items.length ? { type: "stats", title, items } : null;
    }
    default:
      return null;
  }
}

export interface SanitizeContext {
  assetIds: Set<string>;
  theme: PosterTheme;
  brandName?: string;
  fontFamily?: string;
}

/** Coerces untrusted model output into a safe, renderable PosterSpec. Never throws. */
export function sanitizePosterSpec(raw: unknown, ctx: SanitizeContext): PosterSpec {
  const r = isObj(raw) ? raw : {};
  const t = isObj(r.theme) ? r.theme : {};
  const base = ctx.theme;
  const theme: PosterTheme = {
    background: color(t.background, base.background),
    surface: color(t.surface, base.surface),
    text: color(t.text, base.text),
    muted: color(t.muted, base.muted),
    primary: color(t.primary, base.primary),
    accent: color(t.accent, base.accent),
    onPrimary: color(t.onPrimary, base.onPrimary),
  };
  const header = isObj(r.header) ? r.header : {};
  const logoAssetId = typeof header.logoAssetId === "string" && ctx.assetIds.has(header.logoAssetId) ? header.logoAssetId : undefined;
  const ill = isObj(r.illustration) ? r.illustration : {};
  const illAsset = typeof ill.assetId === "string" && ctx.assetIds.has(ill.assetId) ? ill.assetId : undefined;
  const illPrompt = str(ill.prompt, 400);
  const sections = (Array.isArray(r.sections) ? r.sections : []).map(cleanSection).filter((s): s is PosterSection => !!s).slice(0, 6);

  const spec: PosterSpec = {
    version: 1,
    theme,
    fontFamily: str(r.fontFamily, 80) ?? ctx.fontFamily,
    header: { brandName: str(header.brandName, 60) ?? ctx.brandName, tagline: str(header.tagline, 100), logoAssetId },
    headline: str(r.headline ?? r.title, 140) ?? "Untitled poster",
    subheading: str(r.subheading ?? r.subtitle, 240),
    sections,
  };
  if (illAsset || illPrompt) spec.illustration = { assetId: illAsset, prompt: illPrompt };
  if (isObj(r.cta)) {
    const label = str(r.cta.label, 80);
    let url = str(r.cta.url, 400);
    if (url && !/^https?:\/\//i.test(url)) url = /^[\w-]+(\.[\w-]+)+(\/|$)/.test(url) ? `https://${url}` : undefined;
    if (label) spec.cta = { label, url, showQr: !!url && r.cta.showQr !== false };
  }
  if (isObj(r.footer)) {
    const text = multiline(r.footer.text, 300);
    const disclaimer = multiline(r.footer.disclaimer, 500);
    if (text || disclaimer) spec.footer = { text, disclaimer };
  }
  return spec;
}

const LIST_ITEM = /^\s*(?:\d+[.)]|step\s*\d+\s*[:.\-)]?|[-*•▪●])\s+/i;
const URL_RE = /https?:\/\/[^\s)>\]]+/i;
const DECISION_RE = /\s*\(\s*yes\s*:\s*([^;)]*);\s*no\s*:\s*([^)]*)\)\s*$/i;

function parseCta(text: string): PosterSpec["cta"] | undefined {
  const m = URL_RE.exec(text);
  const label = text
    .replace(URL_RE, "")
    .replace(/\(\s*show a qr code\s*\)/i, "")
    .replace(/[:\-–—\s]+$/, "")
    .trim();
  if (!label && !m) return undefined;
  return { label: label.slice(0, 80) || "Learn more", url: m?.[0], showQr: !!m };
}

/** Offline layout used when no Gemini key is configured: reads structure straight out of the brief. */
export function buildFallbackPoster(args: { prompt: string; brandName?: string; theme: PosterTheme; fontFamily?: string }): PosterSpec {
  const lines = args.prompt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const clean = (l: string) => l.replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").replace(/^(headline|title|subheading|subtitle)\s*:\s*/i, "").trim();

  const used = new Set<number>();
  const take = (i: number) => {
    used.add(i);
    return lines[i];
  };
  const LABELLED = /^(brand|key points|callout|call to action|cta|footer|disclaimer|illustration idea)\b|\(flowchart\)\s*:?$/i;

  let stepsTitle: string | undefined;
  let callout: string | undefined;
  let cta: PosterSpec["cta"];
  let illustrationPrompt: string | undefined;
  const footer: string[] = [];
  const disclaimer: string[] = [];

  lines.forEach((l, i) => {
    let m: RegExpExecArray | null;
    if ((m = /^(.+?)\s*\(flowchart\)\s*:?$/i.exec(l))) {
      stepsTitle = m[1].trim();
      used.add(i);
    } else if (/^(brand|key points)\s*:?(\s|$)/i.test(l) && !LIST_ITEM.test(l)) {
      used.add(i);
    } else if ((m = /^callout\s*:\s*(.+)$/i.exec(l))) {
      callout = m[1].trim();
      used.add(i);
    } else if ((m = /^(?:call to action|cta)\s*:\s*(.+)$/i.exec(l))) {
      cta = parseCta(m[1]);
      used.add(i);
    } else if ((m = /^illustration idea\s*:\s*(.+)$/i.exec(l))) {
      illustrationPrompt = m[1].trim();
      used.add(i);
    } else if ((m = /^footer\s*:\s*(.+)$/i.exec(l))) {
      footer.push(m[1].trim());
      used.add(i);
    } else if ((m = /^(?:disclaimer|\*)\s*:?\s*(.+)$/i.exec(l)) && !LIST_ITEM.test(l)) {
      disclaimer.push(m[1].trim());
      used.add(i);
    }
  });

  const plain = (l: string, i: number) => !used.has(i) && !LIST_ITEM.test(l) && !URL_RE.test(l) && !LABELLED.test(l);
  const headlineIdx = lines.findIndex(plain);
  const headline = headlineIdx >= 0 ? clean(take(headlineIdx)) : "Untitled poster";

  let subheading: string | undefined;
  const subIdx = lines.findIndex(plain);
  if (subIdx >= 0 && subIdx <= headlineIdx + 2 && lines[subIdx].length <= 240) subheading = clean(take(subIdx));

  const steps: PosterStep[] = [];
  const bullets: string[] = [];
  lines.forEach((l, i) => {
    if (used.has(i) || !LIST_ITEM.test(l)) return;
    used.add(i);
    let text = l.replace(LIST_ITEM, "").trim();
    if (!/^\s*(\d+[.)]|step)/i.test(l)) {
      bullets.push(text);
      return;
    }
    let decision: PosterStep["decision"];
    const d = DECISION_RE.exec(text);
    if (d) {
      decision = { yes: d[1].trim() || undefined, no: d[2].trim() || undefined };
      text = text.replace(DECISION_RE, "").trim();
    }
    const m = /^(.{3,80}?)(?:\s+[-–—:]\s+|:\s+)(.+)$/.exec(text);
    steps.push({ ...(m ? { label: m[1].trim(), detail: m[2].trim() } : { label: text }), ...(decision ? { decision } : {}) });
  });

  const sections: PosterSection[] = [];
  if (steps.length >= 2) sections.push({ type: "steps", title: stepsTitle, style: "flowchart", items: steps.slice(0, 12) });
  else if (steps.length === 1) bullets.unshift(steps[0].detail ? `${steps[0].label}: ${steps[0].detail}` : steps[0].label);
  if (bullets.length) sections.push({ type: "bullets", title: steps.length >= 2 ? "Key points" : stepsTitle, items: bullets.slice(0, 12) });

  if (!cta) {
    const urlIdx = lines.findIndex((l, i) => !used.has(i) && URL_RE.test(l));
    if (urlIdx >= 0) cta = parseCta(take(urlIdx));
  }

  const rest = lines.filter((_, i) => !used.has(i)).map(clean);
  const calloutBody = [callout, ...rest].filter(Boolean).join("\n").slice(0, 400);
  if (calloutBody) sections.push({ type: "callout", body: calloutBody });

  return sanitizePosterSpec(
    {
      theme: args.theme,
      fontFamily: args.fontFamily,
      header: { brandName: args.brandName },
      headline,
      subheading,
      illustration: illustrationPrompt ? { prompt: illustrationPrompt } : undefined,
      sections,
      cta,
      footer: footer.length || disclaimer.length ? { text: footer.join("\n") || undefined, disclaimer: disclaimer.join("\n") || undefined } : undefined,
    },
    { assetIds: new Set(), theme: args.theme, brandName: args.brandName, fontFamily: args.fontFamily },
  );
}

/** Splits poster text into the plain strings the editor can show and re-apply. */
export function stepsToLines(items: PosterStep[]): string {
  return items
    .map((s) => {
      const base = s.detail ? `${s.label} :: ${s.detail}` : s.label;
      return s.decision ? `${base} ?? ${s.decision.yes ?? ""} || ${s.decision.no ?? ""}` : base;
    })
    .join("\n");
}

export function linesToSteps(text: string): PosterStep[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const [main, branches] = line.split(/\s\?\?\s/);
      const [label, detail] = main.split(/\s::\s/);
      const step: PosterStep = { label: label.trim().slice(0, 120) };
      if (detail?.trim()) step.detail = detail.trim().slice(0, 220);
      if (branches !== undefined) {
        const [yes, no] = branches.split(/\s?\|\|\s?/);
        step.decision = { yes: yes?.trim() || undefined, no: no?.trim() || undefined };
      }
      return step;
    })
    .filter((s) => s.label);
}
