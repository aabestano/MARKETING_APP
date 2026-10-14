import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_TOKENS, resolveBrandTokens } from "../lib/brand-tokens";
import { blankCampaign, buildPosterBrief } from "../lib/campaign";
import { contrastRatio } from "../lib/contrast";
import { brandSwatches, copyColorToTheme, posterContrastWarnings } from "../lib/poster-colors";
import { missingFromPoster, posterPlainText } from "../lib/poster-check";
import { buildLayoutPrompt } from "../lib/poster-layout-prompt";
import { buildFallbackPoster, sanitizePosterSpec, themeFromTokens } from "../lib/poster-spec";
import { sizeFromPreset } from "../lib/poster-sizes";
import type { PosterSpec } from "../lib/poster-types";

const theme = themeFromTokens(DEFAULT_TOKENS);
const ctx = { assetIds: new Set(["logo-a", "logo-b"]), theme, brandName: "Acme" };

test("sanitize keeps tip grids, the header pill, both logos, and the QR caption", () => {
  const spec = sanitizePosterSpec(
    {
      headline: "Stay cool",
      header: { pill: "Heat", logoAssetId: "logo-a", secondLogoAssetId: "logo-b" },
      sections: [
        {
          type: "tips",
          title: "Tips",
          items: [
            { text: "Drink water", icon: "drop" },
            { text: "Wear a hat", icon: "not-an-icon" },
            { text: "   ", icon: "sun" },
            "Rest at midday",
          ],
        },
      ],
      cta: { label: "Learn more", url: "https://example.com/heat", showQr: true, qrCaption: "Scan to see the heat plan" },
    },
    ctx,
  );
  assert.equal(spec.header.pill, "Heat");
  assert.equal(spec.header.logoAssetId, "logo-a");
  assert.equal(spec.header.secondLogoAssetId, "logo-b");
  assert.equal(spec.sections[0].type, "tips");
  if (spec.sections[0].type !== "tips") return;
  assert.deepEqual(
    spec.sections[0].items.map((tip) => tip.icon),
    ["drop", "none", "none"],
  );
  assert.equal(spec.sections[0].items[2].text, "Rest at midday");
  assert.equal(spec.cta?.qrCaption, "Scan to see the heat plan");
  assert.equal(spec.cta?.url, "https://example.com/heat");
});

test("sanitize drops a second logo that is not in the brand book and can turn the first logo off", () => {
  const spec = sanitizePosterSpec({ headline: "Hi", header: { logoAssetId: "", secondLogoAssetId: "missing" } }, ctx);
  assert.equal(spec.header.logoAssetId, "");
  assert.equal(spec.header.secondLogoAssetId, undefined);
});

test("poster text includes the pill, tip copy, destination, and QR caption, and skips them when hidden", () => {
  const spec = sanitizePosterSpec(
    {
      headline: "Stay cool",
      header: { pill: "Heat week" },
      sections: [{ type: "tips", items: [{ text: "Drink 20% more water", icon: "drop" }] }],
      cta: { label: "See the plan", url: "https://example.com/heat", showQr: true, qrCaption: "Scan for hours" },
    },
    ctx,
  );
  const text = posterPlainText(spec);
  assert.match(text, /Heat week/);
  assert.match(text, /Drink 20% more water/);
  assert.match(text, /example.com\/heat/);
  assert.match(text, /Scan for hours/);
  assert.deepEqual(missingFromPoster('Drink 20% more water during "Heat week". Hours at https://example.com/heat. Scan for hours.', spec), []);

  const hidden: PosterSpec = {
    ...spec,
    hiddenBlocks: ["brand", "cta"],
    sections: spec.sections.map((section) => ({ ...section, hidden: true })),
  };
  const hiddenText = posterPlainText(hidden);
  assert.doesNotMatch(hiddenText, /Heat week/);
  assert.doesNotMatch(hiddenText, /20%/);
  assert.doesNotMatch(hiddenText, /Scan for hours/);
  assert.ok(missingFromPoster("Drink 20% more water", hidden).includes("20%"));
});

test("the brief Idea Studio writes stays in the labeled format the poster reads", () => {
  const brief = buildPosterBrief(blankCampaign());
  assert.match(brief, /Save more on your daily medicines/);
  assert.match(brief, /Key points:/);
  assert.match(brief, /Callout:/);
  assert.match(brief, /Call to action: Order Your Medicines on ForwardMG https:\/\/forwardmg\.ph \(show a QR code\)/);
  assert.match(brief, /Destination: https:\/\/forwardmg\.ph/);
  assert.match(brief, /Footer:/);
  assert.match(brief, /Disclaimer:/);
  const spec = buildFallbackPoster({ prompt: brief, brandName: "Acme", theme });
  const missing = missingFromPoster(brief, spec);
  assert.ok(!missing.some((fact) => fact.includes("forwardmg.ph")));
  assert.ok(!missing.includes("50%"));
  assert.ok(!missing.includes("10%"));
  assert.ok(!missing.some((fact) => fact.includes("1,000") || fact.includes("₱1,000")));
});

test("fallback reads a header pill, a QR caption, and a tip grid from the brief", () => {
  const spec = buildFallbackPoster({
    prompt: `Stay cool this week
Header pill: Heat
Tips:
- drop: Drink water before you go out
- sun: Limit time in direct sun
QR caption: Scan for clinic hours
Destination: https://example.com/heat
Call to action: See hours https://example.com/heat (show a QR code)`,
    brandName: "Acme",
    theme,
  });
  assert.equal(spec.headline, "Stay cool this week");
  assert.equal(spec.header.pill, "Heat");
  const tips = spec.sections.find((section) => section.type === "tips");
  assert.ok(tips && tips.type === "tips");
  if (tips && tips.type === "tips") {
    assert.equal(tips.items[0].icon, "drop");
    assert.match(tips.items[0].text, /Drink water/);
    assert.equal(tips.items[1].icon, "sun");
  }
  assert.equal(spec.cta?.url, "https://example.com/heat");
  assert.equal(spec.cta?.qrCaption, "Scan for clinic hours");
  assert.deepEqual(missingFromPoster("Drink water before you go out. Scan for clinic hours at https://example.com/heat", spec), []);
});

test("the layout prompt names the order, the hero, and the pieces in use, and the brief underneath still lays out", () => {
  const spec = sanitizePosterSpec(
    {
      headline: "Stay cool",
      header: { pill: "Heat", logoAssetId: "logo-a", secondLogoAssetId: "logo-b" },
      sections: [{ type: "tips", items: [{ text: "Drink water", icon: "drop" }] }],
      cta: { label: "See hours", url: "https://example.com/heat", showQr: true, qrCaption: "Scan for hours" },
    },
    ctx,
  );
  const prompt = buildLayoutPrompt({
    brief: "Stay cool\nDestination: https://example.com/heat",
    spec,
    brandName: "Acme",
    theme,
    fontFamily: "Poppins, Century Gothic, sans-serif",
    size: sizeFromPreset("a4"),
    heroSize: "m",
    illustrationMode: "none",
  });
  assert.match(prompt, /Layout hero: medium, 27 percent/);
  assert.match(prompt, /Layout order: .*Tip grid/);
  assert.match(prompt, /Layout pieces: tip grid, QR caption, header pill, two logos, and banner styling/);
  assert.match(prompt, /Layout font: Poppins/);
  assert.match(prompt, /https:\/\/example.com\/heat/);
  const laidOut = buildFallbackPoster({ prompt, brandName: "Acme", theme });
  assert.equal(laidOut.headline, "Stay cool");
  assert.equal(laidOut.cta?.url, "https://example.com/heat");
  assert.ok(!/^Layout\b/.test(laidOut.headline));
});

test("brand swatches, copy color, and contrast warnings", () => {
  const swatches = brandSwatches(resolveBrandTokens({ tokens: DEFAULT_TOKENS }));
  assert.ok(swatches.some((swatch) => swatch.hex.toLowerCase() === DEFAULT_TOKENS.primary.toLowerCase()));
  assert.equal(new Set(swatches.map((swatch) => swatch.hex.toLowerCase())).size, swatches.length);

  const copied = copyColorToTheme(theme, "#112233");
  for (const value of Object.values(copied)) assert.equal(value, "#112233");

  const safe = {
    background: "#ffffff",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#334155",
    primary: "#1d4ed8",
    accent: "#1e3a8a",
    onPrimary: "#ffffff",
  };
  assert.deepEqual(posterContrastWarnings(safe), []);
  const warnings = posterContrastWarnings({ ...theme, text: "#cbd5e1", background: "#ffffff", surface: "#ffffff" });
  assert.ok(warnings.some((warning) => warning.startsWith("Text on Background")));
  assert.ok((contrastRatio("#cbd5e1", "#ffffff") ?? 99) < 4.5);
  assert.ok((contrastRatio("#000000", "#ffffff") ?? 0) >= 4.5);
});
