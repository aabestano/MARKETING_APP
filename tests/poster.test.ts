import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFontFaceCss, parseFontFileName, resolveFontStack } from "../lib/fonts";
import { buildFallbackPoster, linesToSteps, sanitizePosterSpec, stepsToLines, themeFromTokens } from "../lib/poster-spec";
import { DEFAULT_TOKENS } from "../lib/brand-tokens";
import { exportPixelRatio, sanitizeSize, sizeFromPreset, trimMm, trimPx } from "../lib/poster-sizes";
import { extractJsonObject } from "../lib/poster-prompt";
import type { BrandAsset } from "../lib/types";

const theme = themeFromTokens(DEFAULT_TOKENS);
const ctx = { assetIds: new Set(["a1"]), theme, brandName: "Acme" };

test("font file names map to family, weight and style", () => {
  assert.deepEqual(parseFontFileName("Montserrat-SemiBold.ttf"), { family: "Montserrat", weight: 600, style: "normal" });
  assert.deepEqual(parseFontFileName("OpenSans-BoldItalic.woff2"), { family: "Open Sans", weight: 700, style: "italic" });
  assert.deepEqual(parseFontFileName("Lora.otf"), { family: "Lora", weight: 400, style: "normal" });
});

test("font resolution: uploaded match wins, otherwise closest system look, otherwise neutral", () => {
  assert.equal(resolveFontStack("montserrat, Arial", ["Montserrat"]).match, "uploaded");
  const closest = resolveFontStack("Playfair Display, serif", []);
  assert.equal(closest.match, "closest");
  assert.match(closest.stack, /Georgia/);
  assert.match(resolveFontStack("Futura", []).stack, /Century Gothic/);
  assert.match(resolveFontStack("Poppins", []).stack, /Century Gothic/);
  assert.equal(resolveFontStack(undefined, []).match, "default");
  assert.equal(resolveFontStack(undefined, ["Brand Sans"]).family, "Brand Sans");
});

test("font-face css embeds uploaded fonts only", () => {
  const assets = [
    { id: "f", bookId: "b", kind: "font", name: "X-Bold.ttf", fontFamily: "X", fontWeight: 700, dataUrl: "data:font/ttf;base64,AAA", purposes: ["poster"], createdAt: 1 },
    { id: "i", bookId: "b", kind: "image", name: "i.png", dataUrl: "data:image/png;base64,BBB", purposes: ["poster"], createdAt: 1 },
  ] as BrandAsset[];
  const css = buildFontFaceCss(assets);
  assert.match(css, /font-family:'X'/);
  assert.match(css, /font-weight:700/);
  assert.ok(!css.includes("BBB"));
});

test("sanitize drops unknown assets, bad colors and bad sections", () => {
  const spec = sanitizePosterSpec(
    {
      theme: { primary: "red", accent: "#ff0000" },
      headline: "  Hello   world ",
      header: { logoAssetId: "nope" },
      illustration: { assetId: "ghost", prompt: "a doctor" },
      sections: [
        { type: "steps", items: [{ label: "One" }, { label: "" }, "Two"] },
        { type: "evil", items: [] },
        { type: "bullets", items: [] },
        { type: "stats", items: [{ value: "50%", label: "off" }, { value: "x" }] },
      ],
      cta: { label: "Go", url: "example.com/x", showQr: true },
    },
    ctx,
  );
  assert.equal(spec.headline, "Hello world");
  assert.equal(spec.theme.primary, theme.primary);
  assert.equal(spec.theme.accent, "#ff0000");
  assert.equal(spec.header.logoAssetId, undefined);
  assert.deepEqual(spec.illustration, { assetId: undefined, prompt: "a doctor" });
  assert.equal(spec.sections.length, 2);
  assert.equal(spec.sections[0].type === "steps" && spec.sections[0].items.length, 2);
  assert.equal(spec.cta?.url, "https://example.com/x");
});

test("sanitize survives garbage input", () => {
  for (const junk of [null, undefined, 5, "str", [], { sections: "no" }]) {
    const s = sanitizePosterSpec(junk, ctx);
    assert.equal(s.version, 1);
    assert.equal(s.headline, "Untitled poster");
    assert.deepEqual(s.sections, []);
  }
});

test("a library asset id is kept when it exists", () => {
  const s = sanitizePosterSpec({ illustration: { assetId: "a1" }, header: { logoAssetId: "a1" } }, ctx);
  assert.equal(s.illustration?.assetId, "a1");
  assert.equal(s.header.logoAssetId, "a1");
});

test("offline fallback reads headline, steps, url and footer from the brief", () => {
  const spec = buildFallbackPoster({
    prompt: "How to order your medicines\nIt takes three quick steps\n1. Create an account - on the website\n2. Upload your prescription\n3. Pay securely\nOrder now: https://example.com/order\nDisclaimer: Terms apply",
    brandName: "Acme",
    theme,
  });
  assert.equal(spec.headline, "How to order your medicines");
  assert.equal(spec.subheading, "It takes three quick steps");
  const steps = spec.sections.find((s) => s.type === "steps");
  assert.ok(steps && steps.type === "steps" && steps.items.length === 3);
  assert.equal(steps && steps.type === "steps" ? steps.items[0].detail : "", "on the website");
  assert.equal(spec.cta?.url, "https://example.com/order");
  assert.equal(spec.cta?.label, "Order now");
  assert.equal(spec.cta?.showQr, true);
  assert.match(spec.footer?.disclaimer ?? "", /Terms apply/);
});

test("offline fallback understands the brief Idea Studio writes", async () => {
  const { blankCampaign, buildPosterBrief } = await import("../lib/campaign");
  const c = blankCampaign();
  c.poster.stepsText = "Check eligibility :: use your card\nIs the Rx valid? ?? Continue || Book a consult\nPay securely";
  c.poster.illustrationHint = "a pharmacist handing over a bag";
  const spec = buildFallbackPoster({ prompt: buildPosterBrief(c), brandName: "Acme", theme });
  assert.equal(spec.headline, c.poster.headline);
  const steps = spec.sections.find((s) => s.type === "steps");
  assert.ok(steps && steps.type === "steps" && steps.items.length === 3);
  assert.deepEqual(steps && steps.type === "steps" ? steps.items[1].decision : null, { yes: "Continue", no: "Book a consult" });
  assert.equal(spec.cta?.url, "https://forwardmg.ph");
  assert.equal(spec.cta?.showQr, true);
  assert.equal(steps && steps.type === "steps" ? steps.items.length : 0, 3);
  const bullets = spec.sections.find((s) => s.type === "bullets");
  assert.ok(bullets && bullets.type === "bullets" && bullets.items.length === 3);
  assert.equal(spec.illustration?.prompt, "a pharmacist handing over a bag");
  assert.ok(spec.footer?.text);
});

test("step editor text round-trips including decisions", () => {
  const text = "Check eligibility :: use your card\nIs the Rx valid? ?? Continue || Book a consult\nDone";
  const steps = linesToSteps(text);
  assert.equal(steps.length, 3);
  assert.deepEqual(steps[1].decision, { yes: "Continue", no: "Book a consult" });
  assert.equal(stepsToLines(steps), text);
});

test("sizes: presets convert to physical size and custom sizes are clamped", () => {
  const a4 = sizeFromPreset("a4");
  const mm = trimMm(a4);
  assert.ok(Math.abs(mm.w - 210) < 0.5 && Math.abs(mm.h - 297) < 0.5);
  assert.deepEqual(trimPx(sizeFromPreset("ig-story")), { w: 1080, h: 1920 });
  const clamped = sanitizeSize({ unit: "mm", width: 5, height: 99999, bleedMm: 99 });
  assert.equal(clamped.width, 40);
  assert.equal(clamped.height, 1200);
  assert.equal(clamped.bleedMm, 10);
});

test("export pixel ratio is clamped for very large posters", () => {
  const small = exportPixelRatio(794, 1123, 300);
  assert.equal(small.clamped, false);
  assert.equal(small.effectiveDpi, 300);
  const huge = exportPixelRatio(1587, 2245, 300);
  assert.equal(huge.clamped, true);
  assert.ok(huge.effectiveDpi < 300 && huge.effectiveDpi >= 150);
});

test("model JSON is extracted from fenced or chatty replies", () => {
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJsonObject('Sure! {"a":2} hope that helps'), { a: 2 });
  assert.throws(() => extractJsonObject("nope"), /not valid JSON/);
});

test("illustration picker matches by name, role and directive words and ignores logos", async () => {
  const { pickIllustration, posterIllustrations, findLogo } = await import("../lib/poster-assets");
  const img = (id: string, name: string, over: Partial<BrandAsset> = {}): BrandAsset =>
    ({ id, bookId: "b", kind: "image", name, dataUrl: "data:image/png;base64,AA", purposes: ["poster"], createdAt: 1, ...over }) as BrandAsset;
  const assets = [
    img("1", "pharmacist-delivery.png"),
    img("2", "flu-vaccine.png", { directive: "seasonal immunization" }),
    img("3", "brand-logo.png", { role: "Logo" }),
    img("4", "email-hero.png", { purposes: ["email"] }),
    img("5", "other.png", { bookId: "other" }),
  ];
  const pool = posterIllustrations(assets, "b");
  assert.deepEqual(pool.map((a) => a.id), ["1", "2"]);
  assert.equal(pickIllustration(pool, "Seasonal immunization drive for flu season")?.id, "2");
  assert.equal(pickIllustration(pool, "Quarterly report")?.id, undefined);
  assert.equal(findLogo(assets, "b")?.id, "3");
});
