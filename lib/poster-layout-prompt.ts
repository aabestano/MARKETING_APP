import type { IllustrationMode, PosterSize, PosterSpec, PosterTheme } from "./poster-types";
import { FINE_PRINT_SCALE, HERO_RATIO, MIN_FIT, defaultLayout, isBlockHidden, isSectionKey, layoutOf, sectionIndex, textSizePx, type HeroSize, type PosterBlockKey } from "./poster-blocks";
import { orientationOf } from "./poster-prompt";
import { describeSize, trimPx } from "./poster-sizes";

const HERO_NAME: Record<HeroSize, string> = { s: "small", m: "medium", l: "large" };

const FIXED_NAME: Record<string, string> = {
  brand: "Brand row",
  headline: "Headline",
  subheading: "Subheading",
  illustration: "Illustration",
  cta: "Call to action",
  footer: "Footer",
};

const SECTION_NAME = { steps: "Steps and flowchart", bullets: "Key points", callout: "Callout", stats: "Stats", tips: "Tip grid" } as const;

const ILLUSTRATION: Record<IllustrationMode, string> = {
  auto: "Use a library picture first, and draw one only if none fits",
  library: "Use a library picture only",
  draw: "Draw the picture only when asked",
  none: "No illustration",
};

function listPhrase(items: string[]): string {
  if (items.length === 0) return "none";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function blockName(key: PosterBlockKey, spec: PosterSpec | null): string {
  if (!isSectionKey(key)) return FIXED_NAME[key] ?? "Block";
  const section = spec?.sections[sectionIndex(key)];
  return section ? SECTION_NAME[section.type] : "Section";
}

/**
 * Local layout directions for poster generation.
 * Every line starts with "Layout" so the offline reader keeps treating the brief underneath as the content.
 */
export function buildLayoutPrompt(args: {
  brief: string;
  spec: PosterSpec | null;
  brandName?: string;
  theme: PosterTheme;
  fontFamily: string;
  size: PosterSize;
  heroSize: HeroSize;
  illustrationMode: IllustrationMode;
}): string {
  const { w, h } = trimPx(args.size);
  const layout = args.spec ? layoutOf(args.spec) : defaultLayout(0);
  const hidden = (key: PosterBlockKey) => (args.spec ? isBlockHidden(args.spec, key) : false);
  const order = layout.order.flatMap((item) => {
    if (item === "banner") return layout.banner.some((key) => !hidden(key)) ? ["Banner"] : [];
    return hidden(item) ? [] : [blockName(item, args.spec)];
  });
  const banner = layout.banner.filter((key) => !hidden(key)).map((key) => blockName(key, args.spec));
  const pieces: string[] = [];
  const spec = args.spec;
  if (spec) {
    if (spec.sections.some((section) => section.type === "tips" && !section.hidden)) pieces.push("tip grid");
    if (spec.cta?.qrCaption && spec.cta.showQr && !spec.hiddenBlocks?.includes("cta")) pieces.push("QR caption");
    if (spec.header.pill && !spec.hiddenBlocks?.includes("brand")) pieces.push("header pill");
    if (spec.header.logoAssetId && spec.header.secondLogoAssetId && !spec.hiddenBlocks?.includes("brand")) pieces.push("two logos");
    if (banner.length > 0) pieces.push("banner styling");
  } else if (/qr code/i.test(args.brief)) {
    pieces.push("QR code");
  }

  const theme = args.theme;
  const heroPct = Math.round(HERO_RATIO[args.heroSize] * 100);
  const lines = [
    args.brandName ? `Layout brand: ${args.brandName}` : "",
    `Layout canvas: ${describeSize(args.size)}, ${orientationOf(w, h)}`,
    `Layout hero: ${HERO_NAME[args.heroSize]}, ${heroPct} percent of the poster height`,
    `Layout text: headline about ${Math.round(textSizePx(4.6, w, h))} px, body about ${Math.round(textSizePx(1.55, w, h))} px, fine print about ${Math.round(textSizePx(1.35 * FINE_PRINT_SCALE, w, h))} px, and text will not shrink below ${Math.round(MIN_FIT * 100)} percent of these sizes`,
    `Layout font: ${args.fontFamily}`,
    `Layout colors: banner background ${theme.primary}, banner text ${theme.onPrimary}, accent ${theme.accent}, text ${theme.text}, background ${theme.background}, cards ${theme.surface}, muted ${theme.muted}`,
    `Layout order: ${listPhrase(order)}`,
    banner.length ? `Layout banner: on, ${listPhrase(banner)}` : "Layout banner: off",
    `Layout pieces: ${listPhrase(pieces)}`,
    `Layout illustration: ${ILLUSTRATION[args.illustrationMode]}`,
  ].filter((line) => line !== "");

  const brief = args.brief.trim();
  return brief ? `${lines.join("\n")}\n\n${brief}` : lines.join("\n");
}
