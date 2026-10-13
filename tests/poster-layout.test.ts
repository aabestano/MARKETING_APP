import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TOKENS } from "../lib/brand-tokens";
import {
  FINE_PRINT_SCALE,
  HERO_RATIO,
  MIN_FIT,
  defaultLayout,
  moveInOrder,
  normalizeLayout,
  removeSection,
  setInBanner,
  textSizePx,
} from "../lib/poster-blocks";
import { missingFromPoster } from "../lib/poster-check";
import { sanitizePosterSpec, themeFromTokens } from "../lib/poster-spec";
import { sizeFromPreset, trimPx } from "../lib/poster-sizes";
import { trimBounds } from "../lib/poster-trim";
import type { PosterSection } from "../lib/poster-types";

const round1 = (n: number) => Math.round(n * 10) / 10;

const theme = themeFromTokens(DEFAULT_TOKENS);
const ctx = { assetIds: new Set<string>(), theme, brandName: "Acme" };

const callout = (body: string): PosterSection => ({ type: "callout", body });

test("sanitize gives the default banner when the model omits layout", () => {
  const spec = sanitizePosterSpec({ headline: "Hi", sections: [{ type: "bullets", items: ["A"] }] }, ctx);
  assert.deepEqual(spec.layout?.banner, ["brand", "headline", "subheading"]);
  assert.equal(spec.layout?.order[0], "banner");
  assert.ok(spec.layout?.order.includes("section:0"));
  assert.ok(spec.layout?.order.includes("illustration"));
});

test("banner toggle appends a callout and puts a turned-off block directly under the banner", () => {
  const sections = [callout("Bring water.")];
  const on = setInBanner(defaultLayout(1), "section:0", true, sections);
  assert.deepEqual(on.banner, ["brand", "headline", "subheading", "section:0"]);
  assert.ok(!on.order.includes("section:0"));
  const off = setInBanner(on, "headline", false, sections);
  const at = off.order.indexOf("banner");
  assert.equal(off.order[at + 1], "headline");
  assert.ok(!off.banner.includes("headline"));
});

test("banner stops at four eligible blocks and rejects other section types", () => {
  const sections: PosterSection[] = [callout("One"), callout("Two"), { type: "bullets", items: ["Point"] }];
  let layout = setInBanner(defaultLayout(3), "section:0", true, sections);
  layout = setInBanner(layout, "section:1", true, sections);
  assert.equal(layout.banner.length, 4);
  assert.ok(!layout.banner.includes("section:1"));
  const bulletsOnly: PosterSection[] = [{ type: "bullets", items: ["Point"] }];
  const bullets = setInBanner(defaultLayout(1), "section:0", true, bulletsOnly);
  assert.ok(!bullets.banner.includes("section:0"));
});

test("turning the last banner block off removes the banner", () => {
  const base = normalizeLayout({ order: ["banner", "cta"], banner: ["subheading"] }, []);
  const off = setInBanner(base, "subheading", false, []);
  assert.deepEqual(off.banner, []);
  assert.equal(off.order[0], "subheading");
  assert.ok(!off.order.includes("banner"));
});

test("the banner moves as one unit, and removing a section renumbers the rest", () => {
  const moved = moveInOrder(defaultLayout(0), 0, 1);
  assert.equal(moved.order[0], "illustration");
  assert.equal(moved.order[1], "banner");

  const sections: PosterSection[] = [{ type: "bullets", items: ["A"] }, callout("Note"), { type: "stats", items: [{ value: "3", label: "days" }] }];
  const withCallout = setInBanner(defaultLayout(3), "section:1", true, sections);
  const next = removeSection(withCallout, 0, sections.slice(1));
  assert.ok(next.banner.includes("section:0"));
  assert.ok(next.order.includes("section:1"));
  assert.ok(!next.banner.includes("section:2") && !next.order.includes("section:2"));
});

test("missing facts are the brief details the poster does not repeat", () => {
  const spec = sanitizePosterSpec(
    {
      headline: "Save on refills",
      sections: [{ type: "callout", body: "Ask your pharmacist" }],
      cta: { label: "Shop", url: "https://example.com/offer" },
    },
    ctx,
  );
  const missing = missingFromPoster(
    'Save 20% until October 31. Email care@example.com. Details at https://example.com/missing. "Free delivery" applies. Dose 500 mg.',
    spec,
  );
  assert.ok(missing.includes("20%"));
  assert.ok(missing.includes("31"));
  assert.ok(missing.includes("care@example.com"));
  assert.ok(missing.includes("https://example.com/missing"));
  assert.ok(missing.includes("Free delivery"));
  assert.ok(missing.includes("500 mg"));
  assert.ok(!missing.some((fact) => fact.includes("example.com/offer")));

  const kept = missingFromPoster("Members save 20% at https://example.com/offer", {
    ...spec,
    headline: "Save 20%",
    cta: { label: "Shop", url: "https://example.com/offer", showQr: true },
  });
  assert.deepEqual(kept, []);
});

test("trim bounds ignore near-white margins and a picture that is already full", () => {
  const width = 6;
  const height = 4;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    pixels[i + 3] = 255;
  }
  assert.equal(trimBounds(pixels, width, height), null);
  const at = (1 * width + 2) * 4;
  pixels[at] = 10;
  pixels[at + 1] = 20;
  pixels[at + 2] = 30;
  assert.deepEqual(trimBounds(pixels, width, height), { x: 2, y: 1, w: 1, h: 1 });
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0;
    pixels[i + 1] = 0;
    pixels[i + 2] = 0;
    pixels[i + 3] = 255;
  }
  assert.equal(trimBounds(pixels, width, height), null);
});

test("A4 fine print stays readable at the 0.85 floor", () => {
  assert.equal(MIN_FIT, 0.85);
  assert.equal(FINE_PRINT_SCALE, 1.1);
  const { w, h } = trimPx(sizeFromPreset("a4"));
  const px = (multiplier: number, fit = 1) => textSizePx(multiplier, w, h, fit);
  assert.ok(px(0.98 * FINE_PRINT_SCALE, MIN_FIT) > px(0.98, 0.4));
  assert.ok(px(4.6, MIN_FIT) > 30);
  assert.equal(Math.round(h * HERO_RATIO.s), Math.round(h * 0.24));
  assert.equal(Math.round(h * HERO_RATIO.m), Math.round(h * 0.27));
  assert.equal(Math.round(h * HERO_RATIO.l), Math.round(h * 0.3));
  assert.deepEqual(
    {
      disclaimer: round1(px(0.98 * FINE_PRINT_SCALE, MIN_FIT)),
      tagline: round1(px(1.3 * FINE_PRINT_SCALE, MIN_FIT)),
      url: round1(px(1.35 * FINE_PRINT_SCALE, MIN_FIT)),
      chip: round1(px(1.15 * FINE_PRINT_SCALE, MIN_FIT)),
      headline: round1(px(4.6, MIN_FIT)),
      heroS: Math.round(h * HERO_RATIO.s),
      heroM: Math.round(h * HERO_RATIO.m),
      heroL: Math.round(h * HERO_RATIO.l),
    },
    { disclaimer: 8.7, tagline: 11.5, url: 11.9, chip: 10.2, headline: 36.9, heroS: 270, heroM: 303, heroL: 337 },
  );
});
