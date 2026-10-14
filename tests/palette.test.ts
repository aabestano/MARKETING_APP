import test from "node:test";
import assert from "node:assert/strict";
import { isMaxicareBl, MAXICARE_BL_TOKENS, resolveBrandTokens } from "../lib/brand-tokens";
import {
  evidenceLine,
  extractHexCounts,
  isIllustrationAsset,
  sampleFromHexCounts,
  sampleFromPixels,
  votePalette,
} from "../lib/palette";

function paint(width: number, height: number, fills: { x: number; y: number; w: number; h: number; hex: string }[], paper = "#FFFFFF"): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, w: number, h: number, hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        const i = (row * width + col) * 4;
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  };
  put(0, 0, width, height, paper);
  for (const fill of fills) put(fill.x, fill.y, fill.w, fill.h, fill.hex);
  return data;
}

const blueBlock = () => paint(40, 40, [{ x: 4, y: 4, w: 16, h: 16, hex: "#0150C8" }]);

test("illustrations are skipped, and logos are kept", () => {
  assert.equal(isIllustrationAsset({ name: "flu-illustration.png", role: "Logo" }), true);
  assert.equal(isIllustrationAsset({ name: "hero.png", role: "Hero Banner" }), true);
  assert.equal(isIllustrationAsset({ name: "MedGrocer logo.png", role: "Logo" }), false);
});

test("template colors include hex and rgb", () => {
  const counts = extractHexCounts("color:#0150C8;background:#fff;border:rgb(224, 97, 12)");
  assert.equal(counts.get("#0150C8"), 1);
  assert.equal(counts.get("#FFFFFF"), 1);
  assert.equal(counts.get("#E0610C"), 1);
});

test("a white file has too little color, and a blue mark leads", () => {
  const blank = sampleFromPixels("a", "Blank.png", paint(16, 16, []));
  assert.equal(blank.status, "skipped");
  assert.equal(blank.reason, "low-color");
  const logo = sampleFromPixels("b", "Logo.png", blueBlock());
  assert.equal(logo.status, "used");
  assert.equal(evidenceLine(logo), "Logo.png: Blue #0150C8 leads.");
});

test("blue leads when most assets are blue, and a second color can be the accent", () => {
  const samples = [
    ...Array.from({ length: 7 }, (_, i) => sampleFromPixels(`b${i}`, `Logo ${i}.png`, blueBlock())),
    ...Array.from({ length: 2 }, (_, i) => sampleFromPixels(`t${i}`, `Partner ${i}.png`, paint(40, 40, [{ x: 4, y: 4, w: 16, h: 16, hex: "#0D9488" }]))),
  ];
  const proposal = votePalette(samples);
  assert.equal(proposal.ready, true);
  assert.equal(proposal.usableCount, 9);
  assert.equal(proposal.tokens.primary, "#0150C8");
  assert.equal(proposal.tokens.accent, "#0D9488");
  assert.match(proposal.summary, /Nothing is saved until you apply it/);
});

test("fewer than 3 usable assets does not propose a palette", () => {
  const proposal = votePalette([
    sampleFromPixels("a", "One.png", blueBlock()),
    sampleFromPixels("b", "Two.png", blueBlock()),
    sampleFromPixels("c", "Blank.png", paint(16, 16, [])),
    sampleFromHexCounts("d", "Notes.txt", extractHexCounts("No colors here.")),
  ]);
  assert.equal(proposal.ready, false);
  assert.equal(proposal.usableCount, 2);
  assert.deepEqual(proposal.tokens, {});
  assert.match(proposal.summary, /At least 3 logos, templates, or guides/);
  assert.match(evidenceLine(proposal.samples[2]), /too little color/);
});

test("an email template color is enough to count", () => {
  const sample = sampleFromHexCounts("t", "Welcome.html", extractHexCounts("<h1 style='color:#0150C8'>Hi</h1>"));
  assert.equal(sample.status, "used");
  assert.equal(sample.lead, "#0150C8");
  const both = sampleFromHexCounts("t2", "Welcome.html", extractHexCounts("color:#0150C8;color:#E0610C"));
  assert.equal(both.lead, "#0150C8");
});

test("a flat brand color stays exact, and near-white edges are not a border", () => {
  const noisy = paint(40, 40, [{ x: 2, y: 2, w: 36, h: 36, hex: "#0150C8" }], "#FDFEFD");
  const sample = sampleFromPixels("n", "Logo.png", noisy);
  assert.equal(sample.lead, "#0150C8");
  const proposal = votePalette([
    sample,
    sampleFromPixels("n2", "Mark.png", noisy),
    sampleFromPixels("n3", "Mark 2.png", blueBlock()),
  ]);
  assert.equal(proposal.tokens.primary, "#0150C8");
  assert.equal(proposal.tokens.borderColor, undefined);
});

test("Maxicare BL colors are opt-in and do not replace the defaults", () => {
  assert.equal(isMaxicareBl(" Maxicare BL "), true);
  assert.equal(isMaxicareBl("MedGrocer"), false);
  assert.equal(MAXICARE_BL_TOKENS.primary, "#0150C8");
  assert.equal(MAXICARE_BL_TOKENS.accent, "#E0610C");
  assert.equal(MAXICARE_BL_TOKENS.textColor, "#1B1B1C");
  assert.equal(MAXICARE_BL_TOKENS.canvasBg, "#F1F5F9");
  assert.equal(MAXICARE_BL_TOKENS.containerBg, "#F8FAFC");
  assert.equal(MAXICARE_BL_TOKENS.borderColor, "#E2E8F0");
  assert.equal(MAXICARE_BL_TOKENS.mutedColor, "#64748B");
  assert.match(MAXICARE_BL_TOKENS.fontFamily ?? "", /Poppins/);
  assert.match(MAXICARE_BL_TOKENS.fontFamily ?? "", /Century Gothic/);
  const applied = resolveBrandTokens({ tokens: MAXICARE_BL_TOKENS });
  assert.equal(applied.primary, "#0150C8");
  assert.equal(applied.fontFamily, MAXICARE_BL_TOKENS.fontFamily);
  assert.equal(resolveBrandTokens({}).accent, "#10B981");
});
