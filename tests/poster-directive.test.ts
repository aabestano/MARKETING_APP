import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TOKENS } from "../lib/brand-tokens";
import { blankCampaign, buildPosterBrief } from "../lib/campaign";
import { fillPosterFromDirective, isBlankDirective } from "../lib/poster-directive";
import { buildPosterPrompt, drawsOnGenerate, posterRevisionInstruction, usesLibraryOnGenerate } from "../lib/poster-prompt";

test("N/A and a blank directive do not replace poster sections", () => {
  const poster = blankCampaign().poster;
  assert.equal(isBlankDirective("N/A"), true);
  assert.equal(isBlankDirective("  n/a "), true);
  assert.equal(isBlankDirective(""), true);
  assert.equal(isBlankDirective(undefined), true);
  assert.equal(fillPosterFromDirective(poster, "N/A"), poster);
  assert.equal(fillPosterFromDirective(poster, "  "), poster);
});

test("a labeled request fills only the sections it names", () => {
  const poster = blankCampaign().poster;
  const next = fillPosterFromDirective(
    poster,
    ["Headline: Stay cool this week", "Subheading: Heat can be hard on your health", "Key points:", "- Drink water", "- Limit midday sun", "Callout: Check on older neighbors"].join("\n"),
  );
  assert.equal(next.headline, "Stay cool this week");
  assert.equal(next.subheading, "Heat can be hard on your health");
  assert.equal(next.pointsText, "Drink water\nLimit midday sun");
  assert.equal(next.callout, "Check on older neighbors");
  assert.equal(next.footer, poster.footer);
  assert.equal(next.stepsText, poster.stepsText);
  assert.equal(next.showQr, poster.showQr);
});

test("an unlabeled request fills the headline and key points", () => {
  const poster = blankCampaign().poster;
  const next = fillPosterFromDirective(poster, "Focus the headline on heat safety\n- Drink water\n- Rest in the shade");
  assert.equal(next.headline, "Heat safety");
  assert.equal(next.pointsText, "Drink water\nRest in the shade");
  assert.equal(next.stepsText, poster.stepsText);
});

test("N/A leaves the poster brief unchanged", () => {
  const campaign = blankCampaign();
  const before = buildPosterBrief(campaign);
  campaign.poster.customDirective = "N/A";
  assert.equal(buildPosterBrief(campaign), before);
  assert.equal(before.includes("Custom directive"), false);
});

test("AI draw only does not pick a library image or draw during generate", () => {
  assert.equal(drawsOnGenerate("draw"), false);
  assert.equal(drawsOnGenerate("auto"), true);
  assert.equal(drawsOnGenerate("none"), false);
  assert.equal(usesLibraryOnGenerate("draw"), false);
  assert.equal(usesLibraryOnGenerate("none"), false);
  assert.equal(usesLibraryOnGenerate("library"), true);
  assert.equal(usesLibraryOnGenerate("auto"), true);
  const prompt = buildPosterPrompt({
    prompt: "A heat safety poster",
    tokens: DEFAULT_TOKENS,
    sizeLabel: "A4",
    orientation: "portrait",
    assets: [{ id: "pic", name: "Heat", kind: "image" }],
    fonts: [],
    illustrationMode: "draw",
  });
  assert.match(prompt, /Do not use a listed asset/);
  assert.match(prompt, /only when the user asks/);
  const instruction = posterRevisionInstruction([
    { label: "Headline", instruction: "Make it shorter" },
    { label: "Footer", instruction: "   " },
  ]);
  assert.match(instruction, /Revise only these sections/);
  assert.match(instruction, /Headline: Make it shorter/);
  assert.equal(instruction.includes("Footer"), false);
});