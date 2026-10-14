import type { ResolvedTokens } from "./brand-tokens";
import type { IllustrationMode, PosterSpec } from "./poster-types";

export interface PosterAssetSummary {
  id: string;
  name: string;
  kind: string;
  role?: string;
  directive?: string;
}

export const POSTER_SYSTEM_INSTRUCTION = `You are a senior brand designer who lays out information posters and campaign posters.
You do not draw pixels. You return a JSON "poster spec" that a renderer turns into the final poster, so write short, scannable copy that fits on a poster.

Return ONLY one JSON object (no markdown fences, no commentary) with this shape:
{
  "theme": { "background": "#hex", "surface": "#hex", "text": "#hex", "muted": "#hex", "primary": "#hex", "accent": "#hex", "onPrimary": "#hex" },
  "fontFamily": "optional font family name, only if the brand specifies one",
  "header": { "brandName": "string", "tagline": "optional", "pill": "optional short header label", "logoAssetId": "id from the asset list, optional", "secondLogoAssetId": "optional second logo id from the asset list" },
  "headline": "max 12 words, the main message",
  "subheading": "optional one-sentence support line",
  "illustration": { "assetId": "id from the asset list, if one fits", "prompt": "describe the picture to draw only if NO listed asset fits" },
  "sections": [
    { "type": "steps", "title": "optional", "style": "flowchart" | "numbered", "items": [ { "label": "short step", "detail": "optional", "decision": { "yes": "outcome", "no": "outcome" } } ] },
    { "type": "bullets", "title": "optional", "items": ["short point"] },
    { "type": "callout", "title": "optional", "body": "short highlighted note" },
    { "type": "stats", "title": "optional", "items": [ { "value": "50%", "label": "short caption" } ] },
    { "type": "tips", "title": "optional", "items": [ { "text": "short tip", "icon": "lightbulb" | "drop" | "sun" | "heart-pulse" | "pill" | "none" } ] }
  ],
  "cta": { "label": "button text", "url": "https://...", "showQr": true, "qrCaption": "optional short line shown with the QR code" },
  "footer": { "text": "contact or support line", "disclaimer": "fine print, optional" }
}

Rules:
- Use the brand colors exactly as given for theme values; never invent off-brand colors. Keep text/background contrast readable.
- Flowcharts: use "steps" with style "flowchart". Use "decision" only for genuine yes/no branches.
- Use at most 4 sections. Keep each step label under 10 words and each detail under 25 words.
- For the illustration, prefer an existing asset (match by name, role and directive). Only write "prompt" when nothing listed fits. Never put text inside an illustration prompt; describe a clean flat illustration subject.
- Copy facts verbatim. Numbers, prices, dates, percentages, doses, phone numbers, email addresses, and URLs must appear exactly as written in the brief.
- Do not invent claims, offers, statistics, dates, names, places, or medical advice. If the brief does not say it, leave it out.
- Do not paraphrase a number, price, date, or required phrase into different words.
- Only set cta.url when the brief gives a real URL. Do not invent URLs.
- When the brief includes lines that start with "Layout", follow that section order, hero size, font, colors, and the layout pieces it names.
- Use a "tips" section only when the brief asks for a tip grid. Each icon must be lightbulb, drop, sun, heart-pulse, pill, or none.
- Set header.pill only when the brief asks for a header label. Set secondLogoAssetId only when the brief asks for two logos.
- Set qrCaption only when the brief gives a caption to show with the QR code.`;

export function normalizeIllustrationMode(value: unknown): IllustrationMode {
  return value === "library" || value === "none" || value === "draw" || value === "auto" ? value : "auto";
}

/** Image generation during Generate poster. AI draw only waits for its own button. */
export function drawsOnGenerate(mode: IllustrationMode): boolean {
  return mode === "auto";
}

/** Library matching during Generate poster. AI draw only never picks a library asset here. */
export function usesLibraryOnGenerate(mode: IllustrationMode): boolean {
  return mode === "auto" || mode === "library";
}

function illustrationInstruction(mode: IllustrationMode): string {
  if (mode === "none") return "Do not include an illustration.";
  if (mode === "library") return "Use only a listed asset for the illustration. If none fits, omit the illustration.";
  if (mode === "draw") return "Do not use a listed asset. Always give an illustration prompt and leave assetId empty. The picture is drawn separately, only when the user asks.";
  return "Prefer a listed asset; if none fits, give an illustration prompt.";
}

const SECTION_KIND = { steps: "Steps and flowchart", bullets: "Key points", callout: "Callout", stats: "Stats", tips: "Tip grid" } as const;

/** Sections the poster AI editor can revise one at a time. */
export function posterRevisionTargets(spec: PosterSpec): { id: string; label: string }[] {
  const items = [
    { id: "brand", label: "Brand row" },
    { id: "headline", label: "Headline" },
    { id: "subheading", label: "Subheading" },
    { id: "illustration", label: "Illustration" },
  ];
  spec.sections.forEach((section, index) => {
    const kind = SECTION_KIND[section.type];
    items.push({ id: `section:${index}`, label: section.title ? `${kind}: ${section.title}` : kind });
  });
  items.push({ id: "cta", label: "Call to action" }, { id: "footer", label: "Footer" });
  return items;
}

/** One revision instruction that names only the sections the user filled in. */
export function posterRevisionInstruction(items: { label: string; instruction: string }[]): string {
  const lines = items.flatMap((item) => {
    const instruction = item.instruction.trim();
    return instruction ? [`${item.label}: ${instruction}`] : [];
  });
  return `Revise only these sections. Leave every other section exactly as it is.\n${lines.join("\n")}`;
}

function describeColors(t: ResolvedTokens): string {
  return [
    `primary = ${t.primary}`,
    `secondary = ${t.secondary}`,
    `accent = ${t.accent}`,
    `page background = ${t.containerBg}`,
    `soft surface = ${t.canvasBg}`,
    `text = ${t.textColor}`,
    `muted text = ${t.mutedColor}`,
    `text on primary = ${t.buttonTextColor}`,
    `brand font family = ${t.fontFamily}`,
  ].join("\n");
}

export function buildPosterPrompt(args: {
  prompt: string;
  brandName?: string;
  tokens: ResolvedTokens;
  sizeLabel: string;
  orientation: "portrait" | "landscape" | "square";
  assets: PosterAssetSummary[];
  fonts: string[];
  illustrationMode: IllustrationMode;
  revision?: { spec: PosterSpec; instruction: string };
}): string {
  const assetLines = args.assets.length
    ? args.assets.map((a) => `- id=${a.id} | ${a.kind}${a.role ? ` (${a.role})` : ""} | ${a.name}${a.directive ? ` | note: ${a.directive}` : ""}`).join("\n")
    : "(no poster assets in the library)";
  const illustrationRule = illustrationInstruction(args.illustrationMode);

  const common = [
    args.brandName ? `BRAND: ${args.brandName}` : "",
    "BRAND COLORS (use for theme):\n" + describeColors(args.tokens),
    `CANVAS: ${args.sizeLabel}, ${args.orientation}. Layout reflows to this shape, so keep content proportionate.`,
    args.fonts.length ? `UPLOADED BRAND FONTS: ${args.fonts.join(", ")} (set fontFamily to one of these when appropriate)` : "No uploaded fonts.",
    `POSTER ASSET LIBRARY:\n${assetLines}`,
    `ILLUSTRATION: ${illustrationRule}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (args.revision) {
    return `${common}\n\nCURRENT POSTER SPEC:\n${JSON.stringify({ ...args.revision.spec, layout: undefined })}\n\nREVISION REQUEST:\n${args.revision.instruction}\n\nReturn the complete updated poster spec JSON. Change only what the request needs.`;
  }
  return `${common}\n\nPOSTER BRIEF:\n${args.prompt}\n\nReturn the poster spec JSON.`;
}

export function buildIllustrationPrompt(subject: string, tokens: Pick<ResolvedTokens, "primary" | "secondary" | "accent">, brandName?: string): string {
  return [
    `Create a clean, modern flat-vector style illustration of: ${subject}.`,
    `Palette: ${tokens.primary}, ${tokens.secondary}, ${tokens.accent} plus white and soft neutrals.`,
    brandName ? `It should feel at home in marketing material for ${brandName}.` : "",
    "Plain light background, centered subject with generous margin, no text, no letters, no logos, no watermark, no borders.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function orientationOf(w: number, h: number): "portrait" | "landscape" | "square" {
  const r = w / h;
  if (r > 1.08) return "landscape";
  if (r < 0.93) return "portrait";
  return "square";
}

export function extractJsonObject(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(stripped.slice(start, end + 1));
    throw new Error("The AI response was not valid JSON.");
  }
}
