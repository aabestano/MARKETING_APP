import type { PosterContent } from "./idea-types";

const LABEL_TO_FIELD: Record<string, keyof PosterContent> = {
  headline: "headline",
  subheading: "subheading",
  "steps title": "stepsTitle",
  steps: "stepsText",
  "key points": "pointsText",
  callout: "callout",
  footer: "footer",
  disclaimer: "disclaimer",
  illustration: "illustrationHint",
  picture: "illustrationHint",
};

const LABEL_RE = /^(headline|subheading|steps title|steps|key points|callout|footer|disclaimer|illustration|picture)\s*:\s*(.*)$/i;

/** "N/A", blank, and a missing value all mean: keep the idea's own poster sections. */
export function isBlankDirective(value: string | undefined): boolean {
  const text = (value ?? "").trim();
  return !text || /^n\/a$/i.test(text);
}

function sentenceCase(value: string): string {
  const text = value.trim().replace(/^(please\s+)?(focus|make)\s+the\s+headline\s+(on|about)\s+/i, "");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function labeledFields(directive: string): Partial<PosterContent> | null {
  const lines = directive.split(/\r?\n/);
  let current: keyof PosterContent | null = null;
  const chunks: Partial<Record<keyof PosterContent, string[]>> = {};
  let found = false;
  for (const line of lines) {
    const match = LABEL_RE.exec(line.trim());
    if (match) {
      found = true;
      current = LABEL_TO_FIELD[match[1].toLowerCase()];
      chunks[current] = match[2].trim() ? [match[2].trim()] : [];
      continue;
    }
    if (!current || !line.trim()) continue;
    chunks[current] = [...(chunks[current] ?? []), line.trim()];
  }
  if (!found) return null;
  const out: Partial<PosterContent> = {};
  for (const [key, parts] of Object.entries(chunks) as [keyof PosterContent, string[]][]) {
    const text = parts.join("\n").trim();
    if (!text) continue;
    if (key === "pointsText" || key === "stepsText") {
      out[key] = text
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
        .filter(Boolean)
        .join("\n");
    } else if (key === "showQr") {
      continue;
    } else {
      out[key] = text;
    }
  }
  return out;
}

/**
 * Fill poster section fields from a custom directive.
 * "N/A" returns the poster unchanged. Labeled requests replace only the sections they name.
 */
export function fillPosterFromDirective(poster: PosterContent, directive: string): PosterContent {
  if (isBlankDirective(directive)) return poster;
  const labeled = labeledFields(directive);
  if (labeled) return { ...poster, ...labeled };

  const lines = directive
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.filter((line) => /^[-*•]\s+/.test(line)).map((line) => line.replace(/^[-*•]\s+/, ""));
  const steps = lines.filter((line) => /^\d+[.)]\s+/.test(line)).map((line) => line.replace(/^\d+[.)]\s+/, ""));
  const prose = lines.filter((line) => !/^[-*•]\s+/.test(line) && !/^\d+[.)]\s+/.test(line));
  const headline = sentenceCase(prose[0] ?? "");
  return {
    ...poster,
    headline: headline || poster.headline,
    subheading: prose[1] ?? poster.subheading,
    pointsText: bullets.length ? bullets.join("\n") : poster.pointsText,
    stepsText: steps.length ? steps.join("\n") : poster.stepsText,
  };
}
