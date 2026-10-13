import type { PosterSpec } from "./poster-types";

const URL_RE = /https?:\/\/[^\s)>\]]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PERCENT_RE = /\d+(?:\.\d+)?\s*%/g;
const MONEY_RE = /(?:₱|\$|€|£)\s?\d+(?:,\d{3})*(?:\.\d+)?|\d+(?:,\d{3})*(?:\.\d+)?\s?(?:php|pesos|usd)/gi;
const UNIT_RE = /\d+(?:\.\d+)?\s?(?:mg|ml|kg|g|mm|cm|days?)/gi;
const QUOTE_RE = /["“]([^"”]{2,80})["”]/g;
const NUMBER_RE = /\d{2,}(?:,\d{3})*(?:\.\d+)?/g;

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").replace(/\s*(%|,)\s*/g, "$1").trim();
}

/** Visible poster copy, used only to test whether a brief fact survived. */
export function posterPlainText(spec: PosterSpec): string {
  const parts: string[] = [];
  const push = (value?: string) => {
    if (value?.trim()) parts.push(value);
  };
  const hidden = new Set(spec.hiddenBlocks ?? []);
  if (!hidden.has("brand")) {
    push(spec.header.brandName);
    push(spec.header.tagline);
    push(spec.header.pill);
  }
  if (!hidden.has("headline")) push(spec.headline);
  if (!hidden.has("subheading")) push(spec.subheading);
  if (!hidden.has("cta")) {
    push(spec.cta?.label);
    push(spec.cta?.url);
    if (spec.cta?.showQr) push(spec.cta.qrCaption);
  }
  if (!hidden.has("footer")) {
    push(spec.footer?.text);
    push(spec.footer?.disclaimer);
  }
  for (const section of spec.sections) {
    if (section.hidden) continue;
    push(section.title);
    if (section.type === "steps") {
      for (const step of section.items) {
        push(step.label);
        push(step.detail);
        push(step.decision?.yes);
        push(step.decision?.no);
      }
    } else if (section.type === "bullets") {
      parts.push(...section.items);
    } else if (section.type === "callout") {
      push(section.body);
    } else if (section.type === "tips") {
      for (const tip of section.items) push(tip.text);
    } else {
      for (const item of section.items) {
        push(item.value);
        push(item.label);
      }
    }
  }
  return parts.join("\n");
}

interface Span {
  start: number;
  end: number;
  text: string;
}

function collect(text: string, re: RegExp, into: Span[]) {
  re.lastIndex = 0;
  for (const match of text.matchAll(re)) {
    const raw = match[1] ?? match[0];
    const start = match.index ?? 0;
    into.push({ start, end: start + match[0].length, text: raw.replace(/[.,;:]+$/, "") });
  }
}

/** Facts from the brief that do not appear verbatim in the poster. Deterministic, and it never edits the poster. */
export function missingFromPoster(brief: string, spec: PosterSpec): string[] {
  const spans: Span[] = [];
  collect(brief, URL_RE, spans);
  collect(brief, EMAIL_RE, spans);
  collect(brief, QUOTE_RE, spans);
  collect(brief, PERCENT_RE, spans);
  collect(brief, MONEY_RE, spans);
  collect(brief, UNIT_RE, spans);
  collect(brief, NUMBER_RE, spans);
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const kept: Span[] = [];
  let cursor = -1;
  for (const span of spans) {
    if (span.start < cursor) continue;
    kept.push(span);
    cursor = span.end;
  }

  const poster = normalize(posterPlainText(spec));
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const span of kept) {
    const fact = span.text.trim();
    const key = normalize(fact);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!poster.includes(key)) missing.push(fact);
  }
  return missing;
}
